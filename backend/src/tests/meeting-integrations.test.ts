import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import request from "supertest";
import axios from "axios";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { createApp } from "../app.js";
import {
  MeetingConnection,
  MeetingOAuthState,
  MeetingImport,
  MeetingProvider,
} from "../modules/meeting-integrations/models.js";
import { Recording } from "../database/models/Recording.js";
import { config } from "../config/index.js";
import { seal, unseal } from "../services/meeting-integrations/crypto.js";
import { connectionToken } from "../services/meeting-integrations/connections.js";
import {
  enqueueMeetingImport,
  processMeetingImport,
} from "../queues/meetingImportQueue.js";
import { audioQueue } from "../queues/audioQueue.js";
import { downloadRecording } from "../services/meeting-integrations/download.js";

vi.mock("../queues/audioQueue.js", () => ({
  audioQueue: { add: vi.fn().mockResolvedValue({ id: "audio-job" }) },
}));
vi.mock("../queues/meetingImportQueue.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../queues/meetingImportQueue.js")>();
  return {
    ...actual,
    enqueueMeetingImport: vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock("../services/meeting-integrations/download.js", () => ({
  downloadRecording: vi.fn(async (options: any) => {
    await fs.writeFile(options.destination, Buffer.from("RIFF fixture audio"));
    return 18;
  }),
}));
vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      request: vi.fn(),
      isAxiosError: actual.default.isAxiosError,
    },
  };
});
// Queue construction should not require a running Redis instance in these API tests.
vi.mock("bullmq", () => ({
  Queue: class {
    add = vi.fn();
    getJob = vi.fn();
  },
  Worker: class {
    on() {}
  },
}));

const app = createApp();
let mongo: MongoMemoryServer;
let token: string;
let otherToken: string;
let userId: string;
let workspaceId: string;
let directory: string;
const oldUploadDir = config.uploadDir;
const http = vi.mocked(axios.request);
const zoomMeeting = {
  uuid: "/meeting//uuid",
  topic: "Zoom design review",
  start_time: "2026-10-20T10:00:00Z",
  duration: 10,
  recording_files: [
    {
      id: "zoom-audio",
      status: "completed",
      file_type: "M4A",
      file_size: 18,
      download_url: "https://us02web.zoom.us/rec/download/audio",
    },
  ],
};
const driveRecording = {
  id: "google-file-12345",
  name: "Meet product review.mp4",
  mimeType: "video/mp4",
  size: "18",
  createdTime: "2026-10-20T11:00:00Z",
  videoMediaMetadata: { durationMillis: "600000" },
  capabilities: { canDownload: true },
};
const webexRecording = {
  id: "webex-recording",
  topic: "Webex planning",
  createTime: "2026-10-20T12:00:00Z",
  durationSeconds: 600,
  sizeBytes: 18,
};

async function register(label: string) {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({
      email: `${label.replace(/\s+/g, "-").toLowerCase()}-${crypto.randomUUID()}@example.test`,
      password: "Meeting-test-password-123!",
      fullName: label,
    });
  expect(res.status).toBe(201);
  return res.body.data;
}
async function connect(provider: MeetingProvider) {
  const res = await request(app)
    .post(`/api/v1/meeting-integrations/${provider}/connect`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  expect(res.status).toBe(200);
  const state = new URL(res.body.data.authorizeUrl).searchParams.get("state")!;
  return { state, cookie: res.headers["set-cookie"][0].split(";")[0] };
}
async function callback(
  provider: MeetingProvider,
  state: string,
  cookie?: string,
) {
  const req = request(app)
    .get(`/api/v1/meeting-integrations/${provider}/callback`)
    .query({ state, code: "fixture-code" });
  return cookie ? req.set("Cookie", cookie) : req;
}

beforeAll(async () => {
  for (const prefix of ["ZOOM", "GOOGLE", "WEBEX"]) {
    vi.stubEnv(`${prefix}_CLIENT_ID`, "fixture-client-id");
    vi.stubEnv(`${prefix}_CLIENT_SECRET`, "fixture-client-secret");
  }
  vi.stubEnv(
    "INTEGRATION_ENCRYPTION_KEY",
    crypto.randomBytes(32).toString("hex"),
  );
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
  await Promise.all([
    MeetingConnection.init(),
    MeetingImport.init(),
    MeetingOAuthState.init(),
  ]);
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "voxmind-meeting-test-"));
  config.uploadDir = directory;
  const owner = await register("Meeting owner");
  token = owner.access_token;
  userId = owner.user.id;
  workspaceId = owner.workspace.id;
  otherToken = (await register("Other owner")).access_token;
});
afterAll(async () => {
  config.uploadDir = oldUploadDir;
  await disconnectDatabase();
  await mongo?.stop();
  await fs.rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.clearAllMocks();
  http.mockImplementation(async (options: any) => {
    const url = options.url as string;
    if (
      url.includes("oauth/token") ||
      url.includes("oauth2.googleapis.com/token") ||
      url.endsWith("/access_token")
    )
      return {
        data: {
          access_token: "fixture-provider-access",
          refresh_token: "fixture-provider-refresh",
          expires_in: 3600,
        },
        headers: {},
      } as any;
    if (url.includes("/users/me/recordings") || url.includes("/meetings/"))
      return {
        data: url.includes("/users/")
          ? { meetings: [zoomMeeting] }
          : zoomMeeting,
        headers: {},
      } as any;
    if (url === "https://www.googleapis.com/drive/v3/files")
      return {
        data: {
          files: options.params.q.includes(
            "mimeType = 'application/vnd.google-apps.folder'",
          )
            ? [{ id: "meet-folder-12345" }]
            : [driveRecording],
        },
        headers: {},
      } as any;
    if (url.includes("/drive/v3/files/"))
      return { data: driveRecording, headers: {} } as any;
    if (url === "https://webexapis.com/v1/recordings")
      return { data: { items: [webexRecording] }, headers: {} } as any;
    if (url.includes("/v1/recordings/"))
      return {
        data: {
          ...webexRecording,
          temporaryDirectDownloadLinks: {
            audioDownloadLink: "https://downloads.webex.com/fixture.mp3",
          },
        },
        headers: {},
      } as any;
    throw new Error("Unexpected fixture URL");
  });
});

describe("Meeting account connections and recording imports", () => {
  it("requires authentication and never claims missing configuration is connected", async () => {
    expect(
      (await request(app).get("/api/v1/meeting-integrations")).status,
    ).toBe(401);
    vi.stubEnv("ZOOM_CLIENT_SECRET", "");
    const status = await request(app)
      .get("/api/v1/meeting-integrations")
      .set("Authorization", `Bearer ${token}`);
    expect(
      status.body.data.find((item: any) => item.provider === "zoom"),
    ).toMatchObject({
      configured: false,
      connected: false,
    });
    expect(
      (
        await request(app)
          .post("/api/v1/meeting-integrations/zoom/connect")
          .set("Authorization", `Bearer ${token}`)
      ).status,
    ).toBe(503);
    expect(status.body.data[0]).not.toHaveProperty("missingVariables");
    expect(status.body.data[0]).not.toHaveProperty("callbackUrl");
    vi.stubEnv("ZOOM_CLIENT_SECRET", "fixture-client-secret");
  });

  it("binds OAuth to this browser, expires state and prevents replay", async () => {
    const pending = await connect("zoom");
    expect((await callback("zoom", pending.state)).headers.location).toContain(
      "OAUTH_STATE_INVALID",
    );
    expect(http).not.toHaveBeenCalled();
    const valid = await callback("zoom", pending.state, pending.cookie);
    expect(valid.status).toBe(303);
    expect(valid.headers.location).toContain("connection=success");
    expect(
      (await callback("zoom", pending.state, pending.cookie)).headers.location,
    ).toContain("OAUTH_STATE_INVALID");
    expect(http).toHaveBeenCalledTimes(1);
    const expired = await connect("webex");
    await MeetingOAuthState.updateOne(
      { provider: "webex" },
      { expiresAt: new Date(0) },
    );
    expect(
      (await callback("webex", expired.state, expired.cookie)).headers.location,
    ).toContain("OAUTH_STATE_INVALID");
  });

  it.each(["zoom", "google-meet", "webex"] as MeetingProvider[])(
    "connects %s, lists recordings and imports exactly one local copy",
    async (provider) => {
      const pending = await connect(provider);
      expect(
        (await callback(provider, pending.state, pending.cookie)).headers
          .location,
      ).toContain("connection=success");
      const account = await MeetingConnection.findOne({
        provider,
        userId,
      }).select("+credentials");
      expect(account!.credentials).not.toContain("fixture-provider-access");
      expect(unseal<any>(account!.credentials).refreshToken).toBe(
        "fixture-provider-refresh",
      );
      const metadata = await request(app)
        .get("/api/v1/meeting-integrations")
        .set("Authorization", `Bearer ${token}`);
      expect(JSON.stringify(metadata.body)).not.toContain("fixture-provider");
      const list = await request(app)
        .get(`/api/v1/meeting-integrations/${provider}/recordings`)
        .set("Authorization", `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.data.recordings).toHaveLength(1);
      expect(list.body.data.recordings[0]).not.toHaveProperty("downloadUrl");
      const id = list.body.data.recordings[0].id;
      const starts = await Promise.all(
        Array.from({ length: 3 }, () =>
          request(app)
            .post(`/api/v1/meeting-integrations/${provider}/imports`)
            .set("Authorization", `Bearer ${token}`)
            .send({ recordingId: id }),
        ),
      );
      expect(starts.every((start) => start.status === 202)).toBe(true);
      expect(enqueueMeetingImport).toHaveBeenCalledTimes(1);
      const importId = starts[0].body.data.id;
      await processMeetingImport(importId);
      const job = await MeetingImport.findById(importId);
      expect(job!.status).toBe("imported");
      const local = await Recording.findById(job!.recordingId);
      expect(local).toMatchObject({
        sourceProvider: provider,
        workspaceId,
        userId,
        status: "queued",
      });
      expect((await fs.stat(local!.storagePath)).size).toBeGreaterThan(0);
      expect(audioQueue.add).toHaveBeenCalledTimes(1);
      expect(downloadRecording).toHaveBeenCalledTimes(1);
      const duplicate = await request(app)
        .post(`/api/v1/meeting-integrations/${provider}/imports`)
        .set("Authorization", `Bearer ${token}`)
        .send({ recordingId: id });
      expect(duplicate.status).toBe(200);
      expect(duplicate.body.data.recordingId).toBe(local!._id);
      expect(enqueueMeetingImport).toHaveBeenCalledTimes(1);
      if (provider === "zoom")
        expect(
          http.mock.calls.some(([options]) =>
            String(options.url).includes("%252Fmeeting%252F%252Fuuid"),
          ),
        ).toBe(true);
    },
  );

  it("isolates connections and import history between workspaces", async () => {
    const status = await request(app)
      .get("/api/v1/meeting-integrations")
      .set("Authorization", `Bearer ${otherToken}`);
    expect(status.body.data.every((item: any) => !item.connected)).toBe(true);
    expect(
      (
        await request(app)
          .get("/api/v1/meeting-integrations/imports")
          .set("Authorization", `Bearer ${otherToken}`)
      ).body.data,
    ).toEqual([]);
    expect(
      (
        await request(app)
          .get("/api/v1/meeting-integrations/zoom/recordings")
          .set("Authorization", `Bearer ${otherToken}`)
      ).status,
    ).toBe(409);
    await request(app)
      .delete("/api/v1/meeting-integrations/zoom/connection")
      .set("Authorization", `Bearer ${otherToken}`);
    expect(
      await MeetingConnection.countDocuments({ provider: "zoom", userId }),
    ).toBe(1);
  });

  it("rejects arbitrary download URLs and untrusted pagination cursors", async () => {
    const url = await request(app)
      .post("/api/v1/meeting-integrations/zoom/imports")
      .set("Authorization", `Bearer ${token}`)
      .send({ recordingId: "test", downloadUrl: "http://127.0.0.1/private" });
    expect(url.status).toBe(400);
    expect(enqueueMeetingImport).not.toHaveBeenCalled();
    const cursor = await request(app)
      .get("/api/v1/meeting-integrations/webex/recordings")
      .query({ cursor: "https://evil.example/steal" })
      .set("Authorization", `Bearer ${token}`);
    expect(cursor.status).toBe(400);
    expect(http).not.toHaveBeenCalled();
  });

  it("serializes token refreshes and retains rotated encrypted credentials", async () => {
    await MeetingConnection.updateOne(
      { provider: "webex", userId },
      {
        credentials: seal({
          accessToken: "expired",
          refreshToken: "old-refresh",
          expiresAt: 0,
        }),
        expiresAt: new Date(0),
      },
    );
    const account = await MeetingConnection.findOne({
      provider: "webex",
      userId,
    });
    const tokens = await Promise.all([
      connectionToken(account!._id),
      connectionToken(account!._id),
    ]);
    expect(tokens).toEqual([
      "fixture-provider-access",
      "fixture-provider-access",
    ]);
    expect(http).toHaveBeenCalledTimes(1);
    expect(http.mock.calls[0][0].data).toContain("grant_type=refresh_token");
  });

  it("waits for another process to rotate a refresh token instead of refreshing it twice", async () => {
    const account = await MeetingConnection.findOne({
      provider: "webex",
      userId,
    });
    await MeetingConnection.updateOne(
      { _id: account!._id },
      {
        credentials: seal({
          accessToken: "expired",
          refreshToken: "old-refresh",
          expiresAt: 0,
        }),
        refreshLockOwner: "another-process",
        refreshLockUntil: new Date(Date.now() + 45000),
      },
    );
    const update = new Promise<void>((resolve) =>
      setTimeout(async () => {
        await MeetingConnection.updateOne(
          { _id: account!._id },
          {
            credentials: seal({
              accessToken: "rotated-by-other-process",
              refreshToken: "new-refresh",
              expiresAt: Date.now() + 3600000,
            }),
            refreshLockOwner: null,
            refreshLockUntil: new Date(0),
          },
        );
        resolve();
      }, 50),
    );
    expect(await connectionToken(account!._id)).toBe(
      "rotated-by-other-process",
    );
    await update;
    expect(http).not.toHaveBeenCalled();
  });

  it("keeps actionable failure status and safely retries a queue handoff without downloading again", async () => {
    const job = await MeetingImport.findOne({ provider: "zoom", workspaceId });
    await MeetingImport.updateOne({ _id: job!._id }, { status: "queued" });
    vi.mocked(audioQueue.add).mockRejectedValueOnce(
      new Error("fixture queue outage"),
    );
    await expect(processMeetingImport(job!._id)).rejects.toThrow(
      "Import could not be completed",
    );
    expect((await MeetingImport.findById(job!._id))!.status).toBe("failed");
    expect(downloadRecording).not.toHaveBeenCalled();
    await processMeetingImport(job!._id);
    expect((await MeetingImport.findById(job!._id))!.status).toBe("imported");
    expect(
      await Recording.countDocuments({ workspaceId, sourceProvider: "zoom" }),
    ).toBe(1);
  });

  it.each([403, 429])(
    "sanitizes provider access errors without leaking OAuth request data (%s)",
    async (status) => {
      http.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status },
        message: "fixture-sensitive-provider-secret",
        config: { headers: { Authorization: "fixture-private-token" } },
      });
      const response = await request(app)
        .get("/api/v1/meeting-integrations/zoom/recordings")
        .set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(status);
      expect(JSON.stringify(response.body)).not.toContain("fixture-sensitive");
      expect(JSON.stringify(response.body)).not.toContain(
        "fixture-private-token",
      );
    },
  );

  it("disconnects locally without deleting imported recordings", async () => {
    const count = await Recording.countDocuments({ workspaceId });
    const disconnected = await request(app)
      .delete("/api/v1/meeting-integrations/google-meet/connection")
      .set("Authorization", `Bearer ${token}`);
    expect(disconnected.status).toBe(200);
    expect(
      await MeetingConnection.countDocuments({
        provider: "google-meet",
        userId,
      }),
    ).toBe(0);
    expect(await Recording.countDocuments({ workspaceId })).toBe(count);
  });
});
