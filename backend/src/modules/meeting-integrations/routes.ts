import { Router, Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import {
  authenticate,
  AuthenticatedRequest,
  requireRole,
  requireSession,
} from "../../middleware/auth.js";
import { AppError } from "../../middleware/errorHandler.js";
import { apiSuccess } from "../../utils/response.js";
import {
  MeetingConnection,
  MeetingOAuthState,
  MeetingImport,
  MeetingProvider,
  providers,
} from "./models.js";
import {
  encryptionKey,
  hash,
  seal,
} from "../../services/meeting-integrations/crypto.js";
import {
  authorizeUrl,
  callbackUrl,
  exchangeTokens,
  frontendBase,
  listRemoteRecordings,
  providerInfo,
  requirements,
} from "../../services/meeting-integrations/providers.js";
import { connectionToken } from "../../services/meeting-integrations/connections.js";
import { enqueueMeetingImport } from "../../queues/meetingImportQueue.js";

const router = Router();
const handle =
  (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void fn(req as AuthenticatedRequest, res).catch(next);
  };
function provider(req: Request): MeetingProvider {
  return z.enum(providers).parse(req.params.provider);
}
const connectionFilter = (
  req: AuthenticatedRequest,
  selected: MeetingProvider,
) => ({
  workspaceId: req.workspaceId!,
  userId: req.user!._id,
  provider: selected,
});
const cookieName = (selected: MeetingProvider) =>
  `vm_meeting_oauth_${selected}`;
const cookieOptions = (selected: MeetingProvider) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: callbackUrl(selected).startsWith("https:"),
  path: new URL(callbackUrl(selected)).pathname,
  maxAge: 600000,
});
function readCookie(req: Request, name: string) {
  const value = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  try {
    return value ? decodeURIComponent(value.slice(name.length + 1)) : "";
  } catch {
    return "";
  }
}
function imported(item: any) {
  return {
    id: item._id,
    provider: item.provider,
    externalId: item.externalId,
    title: item.title,
    status: item.status,
    recordingId: item.recordingId,
    error: item.error,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

// OAuth callbacks are public, but require both the one-time DB state and this browser's HttpOnly nonce.
router.get(
  "/:provider/callback",
  handle(async (req, res) => {
    const selected = provider(req);
    const destination = new URL("/app/api", frontendBase());
    destination.searchParams.set("provider", selected);
    try {
      const state = z.string().min(32).max(256).parse(req.query.state);
      const cookie = readCookie(req, cookieName(selected));
      if (
        !cookie ||
        !crypto.timingSafeEqual(
          Buffer.from(hash(cookie)),
          Buffer.from(hash(state)),
        )
      )
        throw new AppError("Invalid OAuth state.", 400, "OAUTH_STATE_INVALID");
      const pending = await MeetingOAuthState.findOneAndDelete({
        stateHash: hash(state),
        provider: selected,
        expiresAt: { $gt: new Date() },
      });
      if (!pending)
        throw new AppError(
          "This connection request expired. Start again.",
          400,
          "OAUTH_STATE_INVALID",
        );
      if (req.query.error)
        throw new AppError(
          "Account access was not granted.",
          400,
          "OAUTH_ACCESS_DENIED",
        );
      const code = z.string().min(1).max(4096).parse(req.query.code);
      const tokens = await exchangeTokens(selected, {
        code,
        verifier: pending.verifier || undefined,
      });
      await MeetingConnection.findOneAndUpdate(
        {
          workspaceId: pending.workspaceId,
          userId: pending.userId,
          provider: selected,
        },
        {
          credentials: seal(tokens),
          expiresAt: new Date(tokens.expiresAt),
          refreshLockOwner: null,
          refreshLockUntil: new Date(0),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      destination.searchParams.set("connection", "success");
    } catch (error) {
      destination.searchParams.set("connection", "error");
      destination.searchParams.set(
        "reason",
        error instanceof AppError ? error.code : "OAUTH_CONNECTION_FAILED",
      );
    }
    const { maxAge: _maxAge, ...clearOptions } = cookieOptions(selected);
    res.clearCookie(cookieName(selected), clearOptions);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    return res.redirect(303, destination.toString());
  }),
);

router.use(authenticate, requireSession, requireRole(["owner", "admin", "member"]));
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.get(
  "/",
  handle(async (req, res) => {
    const connected = await MeetingConnection.find({
      workspaceId: req.workspaceId,
      userId: req.user!._id,
    }).lean();
    return apiSuccess(
      res,
      providers.map((selected) => {
        const account = connected.find((item) => item.provider === selected);
        return {
          provider: selected,
          name: providerInfo[selected].name,
          configured: requirements(selected).length === 0,
          connected: !!account,
          connectedAt: account?.createdAt || null,
          scopes: providerInfo[selected].scopes.split(" "),
        };
      }),
    );
  }),
);

router.get(
  "/imports",
  handle(async (req, res) => {
    const history = await MeetingImport.find({ workspaceId: req.workspaceId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    return apiSuccess(res, history.map(imported));
  }),
);

router.post(
  "/:provider/connect",
  handle(async (req, res) => {
    const selected = provider(req);
    if (requirements(selected).length)
      throw new AppError(
        "This provider needs to be configured by the server administrator.",
        503,
        "INTEGRATION_NOT_CONFIGURED",
      );
    encryptionKey();
    const state = crypto.randomBytes(32).toString("base64url");
    const verifier =
      selected === "google-meet"
        ? crypto.randomBytes(32).toString("base64url")
        : undefined;
    await MeetingOAuthState.create({
      stateHash: hash(state),
      ...connectionFilter(req, selected),
      verifier,
      expiresAt: new Date(Date.now() + 600000),
    });
    res.cookie(cookieName(selected), state, cookieOptions(selected));
    return apiSuccess(res, {
      authorizeUrl: authorizeUrl(selected, state, verifier),
    });
  }),
);

router.delete(
  "/:provider/connection",
  handle(async (req, res) => {
    const selected = provider(req);
    await MeetingConnection.deleteOne(connectionFilter(req, selected));
    await MeetingOAuthState.deleteMany(connectionFilter(req, selected));
    return apiSuccess(
      res,
      { disconnected: true },
      "Account disconnected from MeetingBrief. Existing imports are kept.",
    );
  }),
);

router.get(
  "/:provider/recordings",
  handle(async (req, res) => {
    const selected = provider(req);
    const options = z
      .object({
        cursor: z.string().max(4096).optional(),
        folderId: z
          .string()
          .regex(/^[\w-]{5,250}$/)
          .optional(),
      })
      .parse(req.query);
    const account = await MeetingConnection.findOne(
      connectionFilter(req, selected),
    );
    if (!account)
      throw new AppError(
        "Connect your account to browse meeting recordings.",
        409,
        "PROVIDER_NOT_CONNECTED",
      );
    const page = await listRemoteRecordings(
      selected,
      await connectionToken(account._id),
      options,
    );
    const history = await MeetingImport.find({
      workspaceId: req.workspaceId,
      provider: selected,
      externalId: { $in: page.recordings.map((item) => item.id) },
    }).lean();
    return apiSuccess(res, {
      recordings: page.recordings.map((item) => ({
        ...item,
        import: history.find((job) => job.externalId === item.id)
          ? imported(history.find((job) => job.externalId === item.id))
          : null,
      })),
      nextCursor: page.nextCursor,
      maxImportSizeMb: (await import("../../config/index.js")).config
        .maxUploadSizeMb,
    });
  }),
);

router.post(
  "/:provider/imports",
  handle(async (req, res) => {
    const selected = provider(req);
    const body = z
      .object({ recordingId: z.string().min(1).max(2048) })
      .strict()
      .parse(req.body);
    const account = await MeetingConnection.findOne(
      connectionFilter(req, selected),
    );
    if (!account)
      throw new AppError(
        "Connect your account before importing recordings.",
        409,
        "PROVIDER_NOT_CONNECTED",
      );
    // The request accepts an ID, never an arbitrary file URL or caller-supplied credentials.
    await MeetingImport.init();
    const candidate = crypto.randomUUID();
    const filter = {
      workspaceId: req.workspaceId!,
      provider: selected,
      externalId: body.recordingId,
    };
    let job;
    try {
      job = await MeetingImport.findOneAndUpdate(
        filter,
        {
          $setOnInsert: {
            _id: candidate,
            connectionId: account._id,
            userId: req.user!._id,
            status: "queued",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error: any) {
      if (error.code !== 11000) throw error;
      job = await MeetingImport.findOne(filter);
    }
    if (!job)
      throw new AppError(
        "Could not start this import.",
        503,
        "IMPORT_QUEUE_UNAVAILABLE",
      );
    if (job.status === "imported")
      return apiSuccess(
        res,
        imported(job),
        "This recording is already in your library.",
      );
    let shouldEnqueue = job._id === candidate;
    if (job.status === "failed") {
      const retry = await MeetingImport.findOneAndUpdate(
        { _id: job._id, status: "failed" },
        {
          status: "queued",
          error: null,
          connectionId: account._id,
          userId: req.user!._id,
        },
        { new: true },
      );
      if (retry) {
        job = retry;
        shouldEnqueue = true;
      }
    }
    if (shouldEnqueue) {
      try {
        await enqueueMeetingImport(job._id);
      } catch {
        await MeetingImport.updateOne(
          { _id: job._id },
          {
            status: "failed",
            error:
              "The import queue is unavailable. Check Redis and try again.",
          },
        );
        throw new AppError(
          "The import queue is unavailable. Try again.",
          503,
          "IMPORT_QUEUE_UNAVAILABLE",
        );
      }
    }
    return apiSuccess(
      res,
      imported(job),
      "Meeting recording queued for import.",
      202,
    );
  }),
);

export const meetingIntegrationRoutes = router;
