import { Queue, Worker } from "bullmq";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getRedisConnection } from "./connection.js";
import {
  MeetingImport,
  MeetingProvider,
  MeetingConnection,
} from "../modules/meeting-integrations/models.js";
import { Recording } from "../database/models/Recording.js";
import { audioQueue } from "./audioQueue.js";
import { config } from "../config/index.js";
import { connectionToken } from "../services/meeting-integrations/connections.js";
import { getRemoteRecording } from "../services/meeting-integrations/providers.js";
import { downloadRecording } from "../services/meeting-integrations/download.js";
import { AppError } from "../middleware/errorHandler.js";
import { logger } from "../middleware/requestLogger.js";

const connection = getRedisConnection();
export const meetingImportQueue = new Queue<{ importId: string }>(
  "meeting-imports",
  {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  },
);

export async function enqueueMeetingImport(importId: string) {
  const old = await meetingImportQueue.getJob(importId);
  if (old) {
    const state = await old.getState();
    if (state === "failed") {
      await old.retry();
      return;
    }
    if (state === "completed") await old.remove();
    else return;
  }
  await meetingImportQueue.add(
    "import-meeting",
    { importId },
    { jobId: importId },
  );
}

export async function processMeetingImport(importId: string) {
  const job = await MeetingImport.findById(importId);
  if (!job || job.status === "imported") return;
  let createdFile: string | undefined;
  try {
    job.status = "downloading";
    job.error = null;
    await job.save();
    // Retry a failed queue handoff using the retained local file, without downloading twice.
    let recording = await Recording.findOne(
      job.recordingId
        ? { _id: job.recordingId, workspaceId: job.workspaceId }
        : {
            workspaceId: job.workspaceId,
            sourceProvider: job.provider,
            sourceExternalId: job.externalId,
          },
    );
    if (!recording) {
      const connected = await MeetingConnection.findOne({
        _id: job.connectionId,
        workspaceId: job.workspaceId,
        userId: job.userId,
      });
      if (!connected)
        throw new AppError(
          "This meeting account was disconnected. Connect it again before importing.",
          409,
          "PROVIDER_NOT_CONNECTED",
        );
      const token = await connectionToken(job.connectionId);
      const remote = await getRemoteRecording(
        job.provider as MeetingProvider,
        token,
        job.externalId,
      );
      job.title = remote.title;
      await job.save();
      const maxBytes = config.maxUploadSizeMb * 1024 * 1024;
      if (remote.sizeBytes > maxBytes)
        throw new AppError(
          "This recording exceeds the configured import size limit.",
          413,
          "IMPORT_TOO_LARGE",
        );
      await fs.promises.mkdir(config.uploadDir, { recursive: true });
      const extension =
        remote.mimeType === "audio/mpeg"
          ? ".mp3"
          : remote.mimeType.startsWith("audio/")
            ? ".m4a"
            : ".mp4";
      createdFile = path.join(
        config.uploadDir,
        `${crypto.randomUUID()}${extension}`,
      );
      const bytes = await downloadRecording({
        url: remote.downloadUrl,
        provider: job.provider as MeetingProvider,
        token: remote.authenticated ? token : undefined,
        destination: createdFile,
        maxBytes,
      });
      recording = await Recording.create({
        workspaceId: job.workspaceId,
        userId: job.userId,
        title: remote.title,
        filename: remote.filename,
        storagePath: createdFile,
        fileSizeBytes: bytes,
        durationSeconds: remote.durationSeconds,
        mimeType: remote.mimeType,
        status: "queued",
        indexStatus: "pending",
        sourceProvider: job.provider,
        sourceExternalId: job.externalId,
      });
      job.recordingId = recording._id;
      job.title = recording.title;
      await job.save();
    }
    job.recordingId = recording._id;
    await job.save();
    const queued = await audioQueue.add(
      "transcribe-audio",
      { recordingId: recording._id },
      { jobId: `meeting-${recording._id}` },
    );
    recording.transcriptionJobId = queued.id || null;
    await recording.save();
    job.status = "imported";
    job.error = null;
    await job.save();
  } catch (error) {
    // Once saved as a Recording, the file is retained for a safe handoff retry.
    if (createdFile && !job.recordingId)
      await fs.promises.rm(createdFile, { force: true });
    job.status = "failed";
    job.error =
      error instanceof AppError
        ? error.message
        : "Import could not be completed. Try again.";
    await job.save();
    throw new Error(job.error);
  }
}

export function startMeetingImportWorker() {
  const worker = new Worker<{ importId: string }>(
    "meeting-imports",
    (job) => processMeetingImport(job.data.importId),
    { connection, concurrency: 2 },
  );
  worker.on("failed", (job) =>
    logger.warn(
      { importId: job?.data.importId },
      "Meeting import failed; see import status for recovery.",
    ),
  );
  return worker;
}
