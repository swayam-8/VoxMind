import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';

export type ActionItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ActionItemPriority = 'low' | 'medium' | 'high';

export interface IActionItem {
  _id: string;
  recordingId: string;
  workspaceId: string;
  task: string;
  assignee: string | null;
  dueDate: string | null;
  status: ActionItemStatus;
  priority: ActionItemPriority;
  createdAt: Date;
  updatedAt: Date;
}

const ActionItemSchema = new Schema<IActionItem>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    recordingId: { type: String, required: true, index: true },
    workspaceId: { type: String, required: true, index: true },
    task: { type: String, required: true, trim: true },
    assignee: { type: String, default: null, trim: true },
    dueDate: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
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

ActionItemSchema.index({ workspaceId: 1, recordingId: 1 });

export const ActionItem: Model<IActionItem> =
  mongoose.models.ActionItem || mongoose.model<IActionItem>('ActionItem', ActionItemSchema);
