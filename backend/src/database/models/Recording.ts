import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';

export type RecordingStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type IndexStatus = 'pending' | 'indexing' | 'completed' | 'failed';

export interface IRecording {
  _id: string;
  workspaceId: string;
  userId: string;
  collectionId: string | null;
  title: string;
  filename: string;
  sourceProvider: string | null;
  sourceExternalId: string | null;
  storagePath: string;
  fileSizeBytes: number;
  durationSeconds: number;
  mimeType: string;
  status: RecordingStatus;
  errorMessage: string | null;
  language: string | null;
  indexStatus: IndexStatus;
  transcriptionJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const RecordingSchema = new Schema<IRecording>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    workspaceId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    collectionId: { type: String, default: null, index: true },
    title: { type: String, required: true, trim: true },
    filename: { type: String, required: true },
    sourceProvider: { type: String, default: null },
    sourceExternalId: { type: String, default: null },
    storagePath: { type: String, required: true },
    fileSizeBytes: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
    mimeType: { type: String, default: 'audio/wav' },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    errorMessage: { type: String, default: null },
    language: { type: String, default: null },
    indexStatus: {
      type: String,
      enum: ['pending', 'indexing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    transcriptionJobId: { type: String, default: null },
  },
  {
    timestamps: true,
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

RecordingSchema.index({ workspaceId: 1, createdAt: -1 });
RecordingSchema.index({ workspaceId: 1, status: 1 });

export const Recording: Model<IRecording> =
  mongoose.models.Recording || mongoose.model<IRecording>('Recording', RecordingSchema);
