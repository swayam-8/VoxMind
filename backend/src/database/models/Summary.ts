import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface ISummaryActionItem {
  text: string;
  assignee?: string;
  dueDate?: string;
  status?: string;
}

export interface ISummary {
  _id: string;
  recordingId: string;
  modelName: string;
  summaryMarkdown: string;
  keyTakeaways: string[];
  decisions: string[];
  topics: string[];
  actionItems: ISummaryActionItem[];
  promptTokens: number;
  completionTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

const SummaryActionItemSchema = new Schema<ISummaryActionItem>(
  {
    text: { type: String, required: true },
    assignee: { type: String, default: null },
    dueDate: { type: String, default: null },
    status: { type: String, default: 'pending' },
  },
  { _id: false }
);

const SummarySchema = new Schema<ISummary>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    recordingId: { type: String, required: true, unique: true, index: true },
    modelName: { type: String, default: 'llama3.2' },
    summaryMarkdown: { type: String, required: true },
    keyTakeaways: { type: [String], default: [] },
    decisions: { type: [String], default: [] },
    topics: { type: [String], default: [] },
    actionItems: { type: [SummaryActionItemSchema], default: [] },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
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

export const Summary: Model<ISummary> =
  mongoose.models.Summary || mongoose.model<ISummary>('Summary', SummarySchema);
