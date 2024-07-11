import { IEvent } from '@/types';
import { collectionIdToERC721Address, collectionIdToERC1155Address } from '@therootnetwork/evm';

export const eventParsers = {
  nftMint: {
    handler: (event: IEvent) => {
      const { start, end, owner, collectionId } = event.args;
      const tokensArray = Array.from({ length: end - start + 1 }, (v, i) => start + i);
      return tokensArray.map((tokenId) => {
        return {
          contractAddress: collectionIdToERC721Address(collectionId),
          owner,
          tokenId,
          type: 'ERC721',
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
        };
      });
    },
  },
  nftTransfer: {
    handler: (event: IEvent) => {
      const { collectionId, serialNumbers, newOwner } = event.args;
      return serialNumbers.map((tokenId) => {
        return {
          contractAddress: collectionIdToERC721Address(collectionId),
          owner: newOwner,
          tokenId,
          type: 'ERC721',
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
        };
      });
    },
  },
  nftBridgedMint: {
    handler: (event: IEvent) => {
      const { collectionId, serialNumbers, owner } = event.args;
      return serialNumbers.map((tokenId) => {
        return {
          contractAddress: collectionIdToERC721Address(collectionId),
          owner,
          tokenId,
          type: 'ERC721',
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
        };
      });
    },
  },
  sftTokenCreate: {
    handler: (event: IEvent) => {
      const {
        tokenId: [collectionId, tokenId],
        tokenOwner: owner,
        initialIssuance: amount,
      } = event.args;
      return [
        {
          contractAddress: collectionIdToERC1155Address(collectionId),
          owner,
          amount,
          tokenId,
          type: 'ERC1155',
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
        },
      ];
    },
  },
  sftMint: {
    handler: (event: IEvent) => {
      const { collectionId, serialNumbers, balances, owner } = event.args;
      return serialNumbers.map((tokenId, index) => {
        return {
          contractAddress: collectionIdToERC1155Address(collectionId),
          owner,
          amount: balances[index] || 0,
          tokenId,
          type: 'ERC1155',
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
        };
      });
    },
  },
  sftTransfer: {
    handler: (event: IEvent) => {
      const { previousOwner, collectionId, serialNumbers, balances, newOwner: owner } = event.args;
      return serialNumbers.reduce((acc, tokenId, index) => {
        if (Number(balances[index]) <= 0) {
          return acc;
        }
        acc.push({
          contractAddress: collectionIdToERC1155Address(collectionId),
          owner,
          amount: balances[index],
          tokenId,
          type: 'ERC1155',
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
        });
        acc.push({
          contractAddress: collectionIdToERC721Address(collectionId),
          owner: previousOwner,
          amount: -1 * balances[index],
          tokenId,
          type: 'ERC1155',
          blockNumber: event.blockNumber,
          timestamp: event.timestamp,
        });
        return acc;
      }, []);
    },
  },
};
