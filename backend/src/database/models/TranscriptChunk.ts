import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface ITranscriptChunk {
  _id: string;
  recordingId: string;
  workspaceId: string;
  chunkIndex: number;
  startTime: number;
  endTime: number;
  speaker: string;
  text: string;
  tokenCount: number;
  embedding: number[];
  createdAt: Date;
}

const TranscriptChunkSchema = new Schema<ITranscriptChunk>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    recordingId: { type: String, required: true, index: true },
    workspaceId: { type: String, required: true, index: true },
    chunkIndex: { type: Number, required: true },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    speaker: { type: String, default: 'Speaker 1' },
    text: { type: String, required: true },
    tokenCount: { type: Number, default: 0 },
    embedding: { type: [Number], default: [] },
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

TranscriptChunkSchema.index({ workspaceId: 1, recordingId: 1 });

export const TranscriptChunk: Model<ITranscriptChunk> =
  mongoose.models.TranscriptChunk ||
  mongoose.model<ITranscriptChunk>('TranscriptChunk', TranscriptChunkSchema);
