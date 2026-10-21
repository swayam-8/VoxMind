import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface IApiKey {
  _id: string;
  workspaceId: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  isRevoked: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    workspaceId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    keyPrefix: { type: String, required: true },
    keyHash: { type: String, required: true, unique: true, index: true },
    isRevoked: { type: Boolean, default: false },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.keyHash;
        return ret;
      },
    },
  }
);

export const ApiKey: Model<IApiKey> =
  mongoose.models.ApiKey || mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
