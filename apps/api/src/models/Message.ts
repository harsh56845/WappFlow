import mongoose, { Schema, Document } from 'mongoose';
import { MessageStatus } from '@whatsflow/shared';

export interface IMessageDocument extends Document {
  campaignId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  customerName: string;
  phone: string;
  templateId: mongoose.Types.ObjectId;
  personalizedContent: string;
  whatsappMessageId?: string;
  status: MessageStatus;
  errorCode?: string;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessageDocument>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'MessageTemplate', required: true },
    personalizedContent: { type: String, required: true },
    whatsappMessageId: { type: String, sparse: true, index: true },
    status: {
      type: String,
      enum: Object.values(MessageStatus),
      default: MessageStatus.PENDING,
      index: true
    },
    errorCode: { type: String },
    errorMessage: { type: String },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    failedAt: { type: Date }
  },
  { timestamps: true }
);

// Idempotency: campaignId + customerId is unique
MessageSchema.index({ campaignId: 1, customerId: 1 }, { unique: true });

export const Message = mongoose.model<IMessageDocument>('Message', MessageSchema);
