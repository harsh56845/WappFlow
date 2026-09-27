import mongoose, { Schema, Document } from 'mongoose';
import { CampaignStatus } from '@whatsflow/shared';

export interface ICampaignDocument extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  templateId: mongoose.Types.ObjectId;
  templateName?: string;
  audience: string;
  totalRecipients: number;
  pendingCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  excludedCount: number;
  status: CampaignStatus;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaignDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'MessageTemplate', required: true },
    templateName: { type: String },
    audience: { type: String, default: 'ALL' },
    totalRecipients: { type: Number, default: 0 },
    pendingCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    readCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    excludedCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.DRAFT,
      index: true
    },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date }
  },
  { timestamps: true }
);

CampaignSchema.index({ userId: 1, createdAt: -1 });

export const Campaign = mongoose.model<ICampaignDocument>('Campaign', CampaignSchema);
