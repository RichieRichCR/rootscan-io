import { getTokenMetadata } from '@/token-data';
import { IBulkWriteDeleteOp, IBulkWriteUpdateOp, IEVMTransaction, IEvent, INftOwner } from '@/types';
import { Job } from 'bullmq';
import { FilterQuery, Models } from 'mongoose';
import { PublicClient } from 'viem';

import { C_EVENT_PARSERS } from './parsers';

export class NftOwnersIndexer {
  #client: PublicClient;
  #currentChainId: number = 7668;
  #db: Models;
  #job?: Job;

  constructor(db: Models, client: PublicClient, job?: Job) {
    if (!client) {
      throw new Error('EVM Client parameter missing');
    }
    this.#client = client;

    if (!db) {
      throw new Error('Database models parameter missing');
    }
    this.#db = db;
    this.#job = job;
  }

  public async run() {
    this.#currentChainId = await this.#client.getChainId();
    const lastProcessedNftBlock = await this.#db.NftOwner.aggregate<INftOwner>([
      {
        $addFields: {
          eventIdParts: { $split: ['$eventId', '-'] },
        },
      },
      {
        $addFields: {
          eventNumber: { $arrayElemAt: ['$eventIdParts', 1] },
        },
      },
      {
        $addFields: {
          eventNumberPadded: {
            $concat: [
              { $arrayElemAt: ['$eventIdParts', 0] },
              {
                $concat: [
                  { $substr: ['00000', 0, { $subtract: [5, { $strLenBytes: '$eventNumber' }] }] },
                  '$eventNumber',
                ],
              },
            ],
          },
        },
      },
      {
        $addFields: {
          eventNumberLong: { $toLong: '$eventNumberPadded' },
        },
      },
      {
        $sort: {
          eventNumberLong: -1,
        },
      },
      { $limit: 1 },
    ]);

    let finished = false;
    while (!finished) {
      finished = await this.processEventsPartial();
    }
    console.info('FINISHED');
  }

  // async processEnmTransactions(limit = 1000): Promise<boolean> {
  //   const filter: FilterQuery<IEVMTransaction> = {
  //     $or: [
  //       { section: 'nft', method: { $in: ['Mint', 'Transfer', 'BridgedMint'] } },
  //       { section: 'sft', method: { $in: ['Mint', 'Transfer', 'TokenCreate'] } },
  //     ],
  //     nftOwnersProcessed: { $ne: true },
  //   };
  //   return false;
  // }

  async processEventsPartial(limit = 200): Promise<boolean> {
    const filter: FilterQuery<IEvent> = {
      $or: [
        { section: 'nft', method: { $in: ['Mint', 'Transfer', 'BridgedMint'] } },
        { section: 'sft', method: { $in: ['Mint', 'Transfer', 'TokenCreate'] } },
      ],
      nftOwnersProcessed: { $ne: true },
    };
    const pipeline = this.#db.Event.aggregate([
      {
        $match: filter,
      },
      {
        $addFields: {
          eventIdParts: { $split: ['$eventId', '-'] },
        },
      },
      {
        $addFields: {
          eventNumber: { $arrayElemAt: ['$eventIdParts', 1] },
        },
      },
      {
        // make eventId like from '3452284-2' to 345228400002 for sorting
        $addFields: {
          eventNumberPadded: {
            $concat: [
              { $arrayElemAt: ['$eventIdParts', 0] },
              {
                $concat: [
                  { $substr: ['00000', 0, { $subtract: [5, { $strLenBytes: '$eventNumber' }] }] },
                  '$eventNumber',
                ],
              },
            ],
          },
        },
      },
      {
        $addFields: {
          eventNumberLong: { $toLong: '$eventNumberPadded' },
        },
      },
      { $sort: { eventNumberLong: 1 } },
    ]);

    // @ts-expect-error aggregatePipeline does exist
    const data = await this.#db.Event.aggregatePaginate(pipeline, { limit });

    await this.processEventsData(data.docs);
    return limit > data.docs.length;
  }

  async processEventsData(data: IEvent[]) {
    const nftEvents: INftOwner[][] = [];
    for (const event of data) {
      const parserName = `${event.section}${event.method}`;
      if (!C_EVENT_PARSERS[parserName]) {
        throw new Error(`Parser ${parserName} not implemented`);
      }
      const res = C_EVENT_PARSERS[parserName].handler(event);
      nftEvents.push(res);
    }
    const nftOwners = nftEvents.filter(Boolean).flat(1);
    const ops: (IBulkWriteUpdateOp | IBulkWriteDeleteOp)[] = [];

    for (const item of nftOwners) {
      const metadata = await getTokenMetadata(
        item.contractAddress as any,
        Number(item.tokenId),
        Number(this.#currentChainId) === 7668 ? 'root' : 'porcini',
      );

      item.attributes = metadata?.attributes;
      (item.image = metadata?.image), (item.animation_url = metadata?.animation_url);

      if (item.type === 'ERC721') {
        ops.push({
          updateOne: {
            filter: {
              tokenId: Number(item.tokenId),
              contractAddress: item.contractAddress,
            },
            update: {
              $set: item,
            },
            upsert: true,
          },
        });
      } else if (item.type === 'ERC1155') {
        const { amount, ...rest } = item;
        ops.push({
          updateOne: {
            filter: {
              tokenId: Number(item.tokenId),
              contractAddress: item.contractAddress,
              owner: item.owner,
            },
            update: {
              $set: rest,
              $inc: {
                amount,
              },
            },
            upsert: true,
          },
        });
      }
    }

    // Write tokens
    await this.#db.NftOwner.bulkWrite(ops);

    // Remove tokens with amount <= 0
    await this.#db.NftOwner.deleteMany({
      amount: { $lte: 0, $ne: null },
      type: 'ERC1155',
    });

    // Set nftOwnersProcessed=true to events
    await this.#db.Event.updateMany(
      {
        eventId: { $in: data.map((i) => i.eventId) },
      },
      {
        $set: {
          nftOwnersProcessed: true,
        },
      },
    );

    const message = `PROCESSED ${data.length} events, insert ${nftOwners.length} owners, last block: ${
      nftOwners[nftOwners.length - 1]?.blockNumber || ''
    }`;

    await this.#job?.log(message);
    console.info(message);
  }
}
