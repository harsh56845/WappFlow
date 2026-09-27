import mongoose, { Schema, Document } from 'mongoose';
import { TemplateCategory, TemplateStatus } from '@whatsflow/shared';

export interface IMessageTemplateDocument extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  category: TemplateCategory;
  language: string;
  body: string;
  variables: string[];
  whatsappTemplateName?: string;
  whatsappTemplateStatus: TemplateStatus;
  createdAt: Date;
  updatedAt: Date;
}

const MessageTemplateSchema = new Schema<IMessageTemplateDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: Object.values(TemplateCategory),
      default: TemplateCategory.MARKETING
    },
    language: { type: String, default: 'en_US' },
    body: { type: String, required: true },
    variables: [{ type: String }],
    whatsappTemplateName: { type: String, trim: true },
    whatsappTemplateStatus: {
      type: String,
      enum: Object.values(TemplateStatus),
      default: TemplateStatus.APPROVED // Default to approved in DEMO_MODE or when mapped
    }
  },
  { timestamps: true }
);

MessageTemplateSchema.index({ userId: 1, name: 1 });

export const MessageTemplate = mongoose.model<IMessageTemplateDocument>('MessageTemplate', MessageTemplateSchema);
