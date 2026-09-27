import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole } from '@whatsflow/shared';

export interface IUserDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  companyName?: string;
  phone?: string;
  lastLoginAt?: Date;
  comparePassword(password: string): Promise<boolean>;
  toAuthJSON(): Record<string, any>;
}

const UserSchema = new Schema<IUserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
    companyName: { type: String, trim: true },
    phone: { type: String, trim: true },
    lastLoginAt: { type: Date }
  },
  {
    timestamps: true
  }
);

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.methods.toAuthJSON = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    companyName: this.companyName,
    phone: this.phone,
    createdAt: this.createdAt?.toISOString(),
    updatedAt: this.updatedAt?.toISOString(),
    lastLoginAt: this.lastLoginAt?.toISOString()
  };
};

export const User = mongoose.model<IUserDocument>('User', UserSchema);
