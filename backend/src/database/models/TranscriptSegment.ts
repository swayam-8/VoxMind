import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface ITranscriptSegment {
  _id: string;
  recordingId: string;
  segmentIndex: number;
  startTime: number;
  endTime: number;
  speaker: string;
  text: string;
  confidence: number;
  createdAt: Date;
}

const TranscriptSegmentSchema = new Schema<ITranscriptSegment>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    recordingId: { type: String, required: true, index: true },
    segmentIndex: { type: Number, required: true },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    speaker: { type: String, default: 'Speaker 1' },
    text: { type: String, required: true },
    confidence: { type: Number, default: 0.95 },
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

TranscriptSegmentSchema.index({ recordingId: 1, segmentIndex: 1 });

export const TranscriptSegment: Model<ITranscriptSegment> =
  mongoose.models.TranscriptSegment ||
  mongoose.model<ITranscriptSegment>('TranscriptSegment', TranscriptSegmentSchema);
