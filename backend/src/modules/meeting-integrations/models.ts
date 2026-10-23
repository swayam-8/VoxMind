import mongoose, { Schema } from "mongoose";
import crypto from "node:crypto";

export const providers = ["zoom", "google-meet", "webex"] as const;
export type MeetingProvider = (typeof providers)[number];

const connectionSchema = new Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    workspaceId: { type: String, required: true },
    userId: { type: String, required: true },
    provider: { type: String, enum: providers, required: true },
    credentials: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    refreshLockUntil: { type: Date, default: () => new Date(0) },
    refreshLockOwner: { type: String, default: null },
  },
  { timestamps: true },
);
connectionSchema.index(
  { workspaceId: 1, userId: 1, provider: 1 },
  { unique: true },
);
export const MeetingConnection = mongoose.model(
  "MeetingConnection",
  connectionSchema,
);

const stateSchema = new Schema({
  stateHash: { type: String, unique: true, required: true },
  provider: { type: String, enum: providers, required: true },
  userId: { type: String, required: true },
  workspaceId: { type: String, required: true },
  verifier: String,
  expiresAt: { type: Date, required: true, expires: 0 },
});
export const MeetingOAuthState = mongoose.model(
  "MeetingOAuthState",
  stateSchema,
);

const importSchema = new Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    workspaceId: { type: String, required: true },
    userId: { type: String, required: true },
    connectionId: { type: String, required: true },
    provider: { type: String, enum: providers, required: true },
    externalId: { type: String, required: true },
    title: { type: String, default: "Meeting recording" },
    status: {
      type: String,
      enum: ["queued", "downloading", "imported", "failed"],
      default: "queued",
    },
    recordingId: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true },
);
importSchema.index(
  { workspaceId: 1, provider: 1, externalId: 1 },
  { unique: true },
);
export const MeetingImport = mongoose.model("MeetingImport", importSchema);
