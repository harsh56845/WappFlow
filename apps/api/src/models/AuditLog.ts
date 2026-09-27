import mongoose, { Schema, Document } from 'mongoose';
import { AuditAction } from '@whatsflow/shared';

export interface IAuditLogDocument extends Document {
  userId: mongoose.Types.ObjectId;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, enum: Object.values(AuditAction), required: true },
    resource: { type: String, required: true },
    resourceId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now, index: true }
  },
  { timestamps: false }
);

export const AuditLog = mongoose.model<IAuditLogDocument>('AuditLog', AuditLogSchema);
