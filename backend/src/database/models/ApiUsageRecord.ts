import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';

export type ResourceType = 'transcription' | 'summary' | 'embedding' | 'qa';

export interface IApiUsageRecord {
  _id: string;
  workspaceId: string;
  userId: string | null;
  apiKeyId: string | null;
  resourceType: ResourceType;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationSeconds: number;
  statusCode: number;
  createdAt: Date;
}

const ApiUsageRecordSchema = new Schema<IApiUsageRecord>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    workspaceId: { type: String, required: true, index: true },
    userId: { type: String, default: null, index: true },
    apiKeyId: { type: String, default: null, index: true },
    resourceType: {
      type: String,
      enum: ['transcription', 'summary', 'embedding', 'qa'],
      required: true,
      index: true,
    },
    model: { type: String, default: '' },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
    statusCode: { type: Number, default: 200 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

ApiUsageRecordSchema.index({ workspaceId: 1, createdAt: -1 });

export const ApiUsageRecord: Model<IApiUsageRecord> =
  mongoose.models.ApiUsageRecord ||
  mongoose.model<IApiUsageRecord>('ApiUsageRecord', ApiUsageRecordSchema);
