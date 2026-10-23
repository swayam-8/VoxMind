import axios, { AxiosRequestConfig } from "axios";
import { createHash } from "node:crypto";
import { AppError } from "../../middleware/errorHandler.js";
import { MeetingProvider } from "../../modules/meeting-integrations/models.js";

export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}
export interface RemoteRecording {
  id: string;
  title: string;
  createdAt: string;
  durationSeconds: number;
  sizeBytes: number;
  mimeType: string;
  filename: string;
}
export interface DownloadRecording extends RemoteRecording {
  downloadUrl: string;
  authenticated: boolean;
}

export const providerInfo = {
  zoom: {
    name: "Zoom",
    prefix: "ZOOM",
    authorize: "https://zoom.us/oauth/authorize",
    token: "https://zoom.us/oauth/token",
    scopes:
      "cloud_recording:read:list_user_recordings cloud_recording:read:list_recording_files cloud_recording:read:download_recording",
  },
  "google-meet": {
    name: "Google Meet",
    prefix: "GOOGLE",
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scopes: "https://www.googleapis.com/auth/drive.readonly",
  },
  webex: {
    name: "Webex",
    prefix: "WEBEX",
    authorize: "https://webexapis.com/v1/authorize",
    token: "https://webexapis.com/v1/access_token",
    scopes: "meeting:recordings_read",
  },
} as const;

export function apiBase(): string {
  return (
    process.env.INTEGRATIONS_API_BASE_URL || "http://localhost:5000"
  ).replace(/\/$/, "");
}
export function frontendBase(): string {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(
    /\/$/,
    "",
  );
}
export function callbackUrl(provider: MeetingProvider) {
  return `${apiBase()}/api/v1/meeting-integrations/${provider}/callback`;
}
export function requirements(provider: MeetingProvider) {
  const prefix = providerInfo[provider].prefix;
  return [
    `${prefix}_CLIENT_ID`,
    `${prefix}_CLIENT_SECRET`,
    "INTEGRATION_ENCRYPTION_KEY",
  ].filter(
    (name) =>
      !process.env[name] ||
      (name === "INTEGRATION_ENCRYPTION_KEY" &&
        !/^[a-f\d]{64}$/i.test(process.env[name]!)),
  );
}
export function authorizeUrl(
  provider: MeetingProvider,
  state: string,
  verifier?: string,
) {
  const info = providerInfo[provider];
  const url = new URL(info.authorize);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: process.env[`${info.prefix}_CLIENT_ID`]!,
    redirect_uri: callbackUrl(provider),
    state,
  }).toString();
  if (provider !== "zoom") url.searchParams.set("scope", info.scopes);
  if (provider === "google-meet") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    if (verifier) {
      url.searchParams.set(
        "code_challenge",
        createHash("sha256").update(verifier).digest("base64url"),
      );
      url.searchParams.set("code_challenge_method", "S256");
    }
  }
  return url.toString();
}

/** Never propagate Axios errors: their config can contain OAuth codes and tokens. */
export async function providerRequest<T = any>(
  options: AxiosRequestConfig,
): Promise<{ data: T; headers: any }> {
  try {
    const result = await axios.request<T>({
      timeout: 30000,
      maxRedirects: 0,
      ...options,
    });
    return { data: result.data, headers: result.headers };
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    if (status === 401)
      throw new AppError(
        "Your meeting connection expired. Reconnect your account.",
        401,
        "PROVIDER_RECONNECT_REQUIRED",
      );
    if (status === 403)
      throw new AppError(
        "The provider denied access. Check your recording permissions and app scopes.",
        403,
        "PROVIDER_ACCESS_DENIED",
      );
    if (status === 429)
      throw new AppError(
        "The meeting provider is rate limiting requests. Try again shortly.",
        429,
        "PROVIDER_RATE_LIMITED",
      );
    throw new AppError(
      "The meeting provider could not complete the request. Check the connection and try again.",
      502,
      "PROVIDER_UNAVAILABLE",
    );
  }
}

export async function exchangeTokens(
  provider: MeetingProvider,
  grant: { code?: string; verifier?: string; refreshToken?: string },
): Promise<Tokens> {
  const info = providerInfo[provider];
  const body = new URLSearchParams(
    grant.refreshToken
      ? { grant_type: "refresh_token", refresh_token: grant.refreshToken }
      : {
          grant_type: "authorization_code",
          code: grant.code!,
          redirect_uri: callbackUrl(provider),
        },
  );
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (provider === "zoom")
    headers.Authorization = `Basic ${Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64")}`;
  else {
    body.set("client_id", process.env[`${info.prefix}_CLIENT_ID`]!);
    body.set("client_secret", process.env[`${info.prefix}_CLIENT_SECRET`]!);
  }
  if (grant.verifier) body.set("code_verifier", grant.verifier);
  const { data } = await providerRequest({
    method: "POST",
    url: info.token,
    data: body.toString(),
    headers,
  });
  if (!data.access_token)
    throw new AppError(
      "The provider did not return an access token. Reconnect your account.",
      502,
      "OAUTH_EXCHANGE_FAILED",
    );
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || grant.refreshToken,
    expiresAt:
      Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000,
  };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const googleFields =
  "id,name,mimeType,size,createdTime,videoMediaMetadata(durationMillis),capabilities(canDownload)";
function googleRecording(file: any): RemoteRecording {
  return {
    id: file.id,
    title: file.name,
    filename: file.name,
    mimeType: file.mimeType,
    createdAt: file.createdTime,
    durationSeconds:
      Number(file.videoMediaMetadata?.durationMillis || 0) / 1000,
    sizeBytes: Number(file.size || 0),
  };
}
function webexRecording(recording: any): RemoteRecording {
  return {
    id: recording.id,
    title: recording.topic || "Webex meeting",
    filename: `${recording.id}.mp4`,
    mimeType: "video/mp4",
    createdAt: recording.createTime,
    durationSeconds: Number(recording.durationSeconds || 0),
    sizeBytes: Number(recording.sizeBytes || 0),
  };
}
function zoomFile(meeting: any): any | undefined {
  const available = (meeting.recording_files || []).filter(
    (file: any) => file.status === "completed" && file.download_url,
  );
  return (
    available.find((file: any) => file.file_type === "M4A") ||
    available.find((file: any) => file.file_type === "MP4")
  );
}
function zoomRecording(meeting: any, file: any): RemoteRecording {
  const audio = file.file_type === "M4A";
  return {
    id: Buffer.from(
      JSON.stringify({ meetingId: meeting.uuid, fileId: file.id }),
    ).toString("base64url"),
    title: meeting.topic || "Zoom meeting",
    filename: `${file.id}.${audio ? "m4a" : "mp4"}`,
    mimeType: audio ? "audio/mp4" : "video/mp4",
    createdAt: meeting.start_time,
    durationSeconds: Number(meeting.duration || 0) * 60,
    sizeBytes: Number(file.file_size || 0),
  };
}

export async function listRemoteRecordings(
  provider: MeetingProvider,
  token: string,
  options: { cursor?: string; folderId?: string } = {},
): Promise<{ recordings: RemoteRecording[]; nextCursor: string | null }> {
  if (provider === "zoom") {
    const to = new Date();
    const from = new Date(to.getTime() - 29 * 86400000);
    const { data } = await providerRequest({
      url: "https://api.zoom.us/v2/users/me/recordings",
      headers: auth(token),
      params: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        page_size: 30,
        next_page_token: options.cursor,
      },
    });
    return {
      recordings: (data.meetings || []).flatMap((meeting: any) => {
        const file = zoomFile(meeting);
        return file ? [zoomRecording(meeting, file)] : [];
      }),
      nextCursor: data.next_page_token || null,
    };
  }
  if (provider === "google-meet") {
    let folders: string[];
    if (options.folderId) folders = [options.folderId];
    else {
      const { data } = await providerRequest({
        url: "https://www.googleapis.com/drive/v3/files",
        headers: auth(token),
        params: {
          q: "trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = 'Meet Recordings'",
          fields: "files(id)",
          pageSize: 100,
        },
      });
      folders = (data.files || []).map((folder: any) => folder.id);
    }
    if (!folders.length) return { recordings: [], nextCursor: null };
    const q = `trashed = false and (${folders.map((id) => `'${id.replace(/['\\]/g, "")}' in parents`).join(" or ")}) and (mimeType contains 'video/' or mimeType contains 'audio/')`;
    const { data } = await providerRequest({
      url: "https://www.googleapis.com/drive/v3/files",
      headers: auth(token),
      params: {
        q,
        fields: `nextPageToken,files(${googleFields})`,
        orderBy: "createdTime desc",
        pageSize: 30,
        pageToken: options.cursor,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      },
    });
    return {
      recordings: (data.files || [])
        .filter((file: any) => file.capabilities?.canDownload !== false)
        .map(googleRecording),
      nextCursor: data.nextPageToken || null,
    };
  }
  let url = "https://webexapis.com/v1/recordings";
  if (options.cursor) {
    let parsed: URL;
    try {
      parsed = new URL(options.cursor);
    } catch {
      throw new AppError("Invalid recording cursor.", 400, "INVALID_CURSOR");
    }
    if (
      parsed.origin !== "https://webexapis.com" ||
      parsed.pathname !== "/v1/recordings" ||
      parsed.username ||
      parsed.password
    )
      throw new AppError("Invalid recording cursor.", 400, "INVALID_CURSOR");
    url = parsed.toString();
  }
  const { data, headers } = await providerRequest({
    url,
    headers: auth(token),
    params: options.cursor ? undefined : { max: 30 },
  });
  const next = String(headers.link || "").match(/<([^>]+)>;\s*rel="next"/);
  return {
    recordings: (data.items || [])
      .filter(
        (r: any) =>
          !r.status || ["available", "completed", "ready"].includes(r.status),
      )
      .map(webexRecording),
    nextCursor: next?.[1] || null,
  };
}

export async function getRemoteRecording(
  provider: MeetingProvider,
  token: string,
  id: string,
): Promise<DownloadRecording> {
  if (provider === "google-meet") {
    if (!/^[\w-]{5,250}$/.test(id))
      throw new AppError(
        "Invalid Google recording ID.",
        400,
        "INVALID_RECORDING",
      );
    const { data } = await providerRequest({
      url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`,
      headers: auth(token),
      params: { fields: googleFields, supportsAllDrives: true },
    });
    if (
      !/^(audio|video)\//.test(data.mimeType) ||
      data.capabilities?.canDownload === false
    )
      throw new AppError(
        "This Drive recording cannot be downloaded.",
        400,
        "RECORDING_UNAVAILABLE",
      );
    return {
      ...googleRecording(data),
      downloadUrl: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`,
      authenticated: true,
    };
  }
  if (provider === "zoom") {
    let parsed: { meetingId: string; fileId: string };
    try {
      parsed = JSON.parse(Buffer.from(id, "base64url").toString("utf8"));
      if (
        typeof parsed.meetingId !== "string" ||
        typeof parsed.fileId !== "string"
      )
        throw new Error();
    } catch {
      throw new AppError(
        "Invalid Zoom recording ID.",
        400,
        "INVALID_RECORDING",
      );
    }
    // Zoom requires double URL encoding for UUIDs that start with / or contain //.
    const uuid =
      parsed.meetingId.startsWith("/") || parsed.meetingId.includes("//")
        ? encodeURIComponent(encodeURIComponent(parsed.meetingId))
        : encodeURIComponent(parsed.meetingId);
    const { data } = await providerRequest({
      url: `https://api.zoom.us/v2/meetings/${uuid}/recordings`,
      headers: auth(token),
    });
    const file = (data.recording_files || []).find(
      (f: any) =>
        f.id === parsed.fileId &&
        f.status === "completed" &&
        ["M4A", "MP4"].includes(f.file_type),
    );
    if (!file?.download_url)
      throw new AppError(
        "This Zoom recording is not available for download yet.",
        400,
        "RECORDING_UNAVAILABLE",
      );
    return {
      ...zoomRecording({ ...data, uuid: parsed.meetingId }, file),
      downloadUrl: file.download_url,
      authenticated: true,
    };
  }
  const { data } = await providerRequest({
    url: `https://webexapis.com/v1/recordings/${encodeURIComponent(id)}`,
    headers: auth(token),
  });
  const links = data.temporaryDirectDownloadLinks;
  const url = links?.audioDownloadLink || links?.recordingDownloadLink;
  if (!url)
    throw new AppError(
      "Webex has not provided a direct download. Check recording availability and download permissions.",
      400,
      "RECORDING_UNAVAILABLE",
    );
  const audio = !!links.audioDownloadLink;
  return {
    ...webexRecording(data),
    filename: `${data.id}.${audio ? "mp3" : "mp4"}`,
    mimeType: audio ? "audio/mpeg" : "video/mp4",
    downloadUrl: url,
    authenticated: false,
  };
}
