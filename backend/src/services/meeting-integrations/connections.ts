import crypto from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  MeetingConnection,
  MeetingProvider,
} from "../../modules/meeting-integrations/models.js";
import { AppError } from "../../middleware/errorHandler.js";
import { exchangeTokens, Tokens } from "./providers.js";
import { seal, unseal } from "./crypto.js";

const refreshes = new Map<string, Promise<string>>();
const disconnected = () =>
  new AppError(
    "Connect your meeting account before importing recordings.",
    409,
    "PROVIDER_NOT_CONNECTED",
  );

async function refreshConnection(connectionId: string): Promise<string> {
  const owner = crypto.randomUUID();
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    const connection =
      await MeetingConnection.findById(connectionId).select("+credentials");
    if (!connection) throw disconnected();
    const tokens = unseal<Tokens>(connection.credentials);
    if (tokens.expiresAt > Date.now() + 60000) return tokens.accessToken;
    const locked = await MeetingConnection.findOneAndUpdate(
      {
        _id: connectionId,
        $or: [
          { refreshLockUntil: { $lt: new Date() } },
          { refreshLockUntil: { $exists: false } },
        ],
      },
      {
        refreshLockOwner: owner,
        refreshLockUntil: new Date(Date.now() + 45000),
      },
      { new: true },
    ).select("+credentials");
    if (!locked) {
      await delay(100);
      continue;
    }
    try {
      const latest = unseal<Tokens>(locked.credentials);
      if (latest.expiresAt > Date.now() + 60000) return latest.accessToken;
      if (!latest.refreshToken)
        throw new AppError(
          "Reconnect your meeting account to continue.",
          401,
          "PROVIDER_RECONNECT_REQUIRED",
        );
      const updated = await exchangeTokens(locked.provider as MeetingProvider, {
        refreshToken: latest.refreshToken,
      });
      const saved = await MeetingConnection.updateOne(
        { _id: connectionId, refreshLockOwner: owner },
        { credentials: seal(updated), expiresAt: new Date(updated.expiresAt) },
      );
      if (!saved.matchedCount)
        throw new AppError(
          "This meeting connection changed. Try again.",
          409,
          "PROVIDER_CONNECTION_CHANGED",
        );
      return updated.accessToken;
    } finally {
      await MeetingConnection.updateOne(
        { _id: connectionId, refreshLockOwner: owner },
        { refreshLockOwner: null, refreshLockUntil: new Date(0) },
      );
    }
  }
  throw new AppError(
    "The meeting account is being refreshed. Try again shortly.",
    409,
    "PROVIDER_REFRESH_PENDING",
  );
}

export async function connectionToken(connectionId: string): Promise<string> {
  const pending = refreshes.get(connectionId);
  if (pending) return pending;
  const task = refreshConnection(connectionId);
  refreshes.set(connectionId, task);
  try {
    return await task;
  } finally {
    refreshes.delete(connectionId);
  }
}
