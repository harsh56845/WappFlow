import mongoose, { Schema, Document } from 'mongoose';
import { encrypt, decrypt } from '../utils/crypto';

export interface IWhatsAppConfigDocument extends Document {
  userId: mongoose.Types.ObjectId;
  businessAccountId: string;
  phoneNumberId: string;
  encryptedAccessToken: string;
  webhookVerifyToken: string;
  displayPhoneNumber?: string;
  getAccessToken(): string;
}

const WhatsAppConfigSchema = new Schema<IWhatsAppConfigDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    businessAccountId: { type: String, required: true, trim: true },
    phoneNumberId: { type: String, required: true, trim: true },
    encryptedAccessToken: { type: String, required: true },
    webhookVerifyToken: { type: String, required: true, trim: true },
    displayPhoneNumber: { type: String, trim: true }
  },
  { timestamps: true }
);

WhatsAppConfigSchema.methods.getAccessToken = function (): string {
  return decrypt(this.encryptedAccessToken);
};

export const WhatsAppConfig = mongoose.model<IWhatsAppConfigDocument>('WhatsAppConfig', WhatsAppConfigSchema);
