import mongoosePaginate from '@/mongoose-paginate-v2';
import { IAddress } from '@/types';
import Mongoose, { Schema } from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

const schema = new Schema<IAddress, Mongoose.Model<IAddress>>({
  address: { type: String },
  rns: { type: String },
  nameTag: { type: String },
  isContract: { type: Boolean },
  balance: { type: Object },
});

schema.index({ address: 1 }, { unique: true });
schema.index({ balance: 1 });
schema.index({ 'balance.free': -1 });
schema.index({ 'balance.free': 1 });

schema.virtual('isVerifiedContract', {
  ref: 'VerifiedContract',
  localField: 'address',
  foreignField: 'address',
  justOne: true,
});

schema.virtual('token', {
  ref: 'Token',
  localField: 'address',
  foreignField: 'contractAddress',
  justOne: true,
});

schema.plugin(mongoosePaginate);
schema.plugin(aggregatePaginate);

const Model = Mongoose.model<IAddress, Mongoose.PaginateModel<IAddress>>('Address', schema);

Model.syncIndexes();

export default Model;
