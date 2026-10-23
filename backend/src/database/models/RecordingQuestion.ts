import crypto from 'crypto';
import mongoose, { Schema, Model } from 'mongoose';

export interface IRecordingQuestion {
  _id: string;
  recordingId: string;
  workspaceId: string;
  userId: string;
  question: string;
  answer: string;
  supportedByTranscript: boolean;
  timestamps: number[];
  modelName: string;
  createdAt: Date;
}

const RecordingQuestionSchema = new Schema<IRecordingQuestion>({
  _id: { type: String, default: () => crypto.randomUUID() },
  recordingId: { type: String, required: true },
  workspaceId: { type: String, required: true },
  userId: { type: String, required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  supportedByTranscript: { type: Boolean, default: false },
  timestamps: { type: [Number], default: [] },
  modelName: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

RecordingQuestionSchema.index({ workspaceId: 1, recordingId: 1, userId: 1, createdAt: 1 });
export const RecordingQuestion: Model<IRecordingQuestion> = mongoose.models.RecordingQuestion ||
  mongoose.model<IRecordingQuestion>('RecordingQuestion', RecordingQuestionSchema);
