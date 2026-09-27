import mongoose, { Schema, Document } from 'mongoose';
import { OptInStatus } from '@whatsflow/shared';

export interface ICustomerDocument extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  attributes: Map<string, string>;
  source: string;
  optInStatus: OptInStatus;
  optInTimestamp?: Date;
  optInSource?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomerDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    attributes: { type: Map, of: String, default: {} },
    source: { type: String, default: 'EXCEL_IMPORT' },
    optInStatus: {
      type: String,
      enum: Object.values(OptInStatus),
      default: OptInStatus.NOT_OPTED_IN,
      index: true
    },
    optInTimestamp: { type: Date },
    optInSource: { type: String }
  },
  {
    timestamps: true
  }
);

CustomerSchema.index({ userId: 1, phone: 1 }, { unique: true });

export const Customer = mongoose.model<ICustomerDocument>('Customer', CustomerSchema);
