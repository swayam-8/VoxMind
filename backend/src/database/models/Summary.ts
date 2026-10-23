import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface ISummaryActionItem {
  text: string;
  assignee?: string;
  dueDate?: string;
  status?: string;
  sourceTimestamp?: number | null;
}

export interface ISummaryDecision {
  decision: string;
  context?: string | null;
  source_timestamp?: number | null;
  sourceTimestamp?: number | null;
}

export interface ISummary {
  _id: string;
  recordingId: string;
  modelName: string;
  summaryMarkdown: string;
  keyTakeaways: string[];
  decisions: ISummaryDecision[];
  topics: string[];
  actionItems: ISummaryActionItem[];
  promptTokens: number;
  completionTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

const SummaryDecisionSchema = new Schema(
  {
    decision: { type: String, required: true },
    context: { type: String, default: null },
    source_timestamp: { type: Number, default: null },
    sourceTimestamp: { type: Number, default: null },
  },
  { _id: false, strict: false }
);

const SummaryActionItemSchema = new Schema(
  {
    text: { type: String, required: true },
    assignee: { type: String, default: null },
    dueDate: { type: String, default: null },
    due_date: { type: String, default: null },
    status: { type: String, default: 'pending' },
    sourceTimestamp: { type: Number, default: null },
  },
  { _id: false, strict: false }
);

const SummarySchema = new Schema<ISummary>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    recordingId: { type: String, required: true, unique: true, index: true },
    modelName: { type: String, default: 'llama3.2' },
    summaryMarkdown: { type: String, required: true },
    keyTakeaways: { type: [String], default: [] },
    decisions: { type: [SummaryDecisionSchema], default: [] },
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
