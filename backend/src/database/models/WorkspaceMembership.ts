import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface IWorkspaceMembership {
  _id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMembershipSchema = new Schema<IWorkspaceMembership>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    workspaceId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      default: 'member',
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

WorkspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const WorkspaceMembership: Model<IWorkspaceMembership> =
  mongoose.models.WorkspaceMembership ||
  mongoose.model<IWorkspaceMembership>('WorkspaceMembership', WorkspaceMembershipSchema);
