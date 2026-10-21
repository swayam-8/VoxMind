import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';

export interface ICollection {
  _id: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

const CollectionSchema = new Schema<ICollection>(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    workspaceId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    color: { type: String, default: '#6366f1' },
    createdById: { type: String, required: true },
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

CollectionSchema.index({ workspaceId: 1, name: 1 });

export const Collection: Model<ICollection> =
  mongoose.models.Collection || mongoose.model<ICollection>('Collection', CollectionSchema);
