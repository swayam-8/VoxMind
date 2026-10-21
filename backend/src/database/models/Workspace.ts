import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface IWorkspace {
  _id: string;
  name: string;
  slug: string;
  createdBy: string;
  isPersonal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    createdBy: { type: String, required: true },
    isPersonal: { type: Boolean, default: false },
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

export const Workspace: Model<IWorkspace> =
  mongoose.models.Workspace || mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
