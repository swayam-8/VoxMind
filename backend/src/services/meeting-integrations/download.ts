import axios from "axios";
import fs from "node:fs";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AppError } from "../../middleware/errorHandler.js";
import { MeetingProvider } from "../../modules/meeting-integrations/models.js";

export function validateDownloadUrl(
  raw: string,
  provider: MeetingProvider,
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError(
      "Invalid provider download address.",
      502,
      "UNSAFE_DOWNLOAD",
    );
  }
  const roots =
    provider === "zoom"
      ? ["zoom.us", "zoom.com"]
      : provider === "google-meet"
        ? ["googleapis.com", "googleusercontent.com"]
        : ["webex.com", "webexcontent.com", "webexapis.com", "wbx2.com"];
  const trusted = roots.some(
    (root) => url.hostname === root || url.hostname.endsWith(`.${root}`),
  );
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password ||
    !trusted
  )
    throw new AppError(
      "The provider returned an unsupported download address.",
      502,
      "UNSAFE_DOWNLOAD",
    );
  return url;
}

/** Bounded, streamed download. Validate every redirect and never forward OAuth headers to a new origin. */
export async function downloadRecording(options: {
  url: string;
  provider: MeetingProvider;
  token?: string;
  destination: string;
  maxBytes: number;
}): Promise<number> {
  let url = validateDownloadUrl(options.url, options.provider);
  const initialOrigin = url.origin;
  const signal = AbortSignal.timeout(300000);
  let bytes = 0;
  let created = false;
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0)
    throw new AppError(
      "Configure a positive recording import size limit.",
      503,
      "IMPORT_LIMIT_INVALID",
    );
  try {
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response = await axios.request({
        url: url.toString(),
        responseType: "stream",
        maxRedirects: 0,
        timeout: 60000,
        signal,
        validateStatus: (code) => code >= 200 && code < 400,
        headers:
          options.token && url.origin === initialOrigin
            ? { Authorization: `Bearer ${options.token}` }
            : {},
      });
      if (response.status >= 300) {
        response.data.destroy();
        if (!response.headers.location || redirects === 5)
          throw new AppError(
            "Too many recording download redirects.",
            502,
            "DOWNLOAD_FAILED",
          );
        url = validateDownloadUrl(
          new URL(response.headers.location, url).toString(),
          options.provider,
        );
        continue;
      }
      const length = Number(response.headers["content-length"] || 0);
      if (length > options.maxBytes) {
        response.data.destroy();
        throw new AppError(
          "This recording exceeds the configured import size limit.",
          413,
          "IMPORT_TOO_LARGE",
        );
      }
      if (
        /text\/|application\/json/i.test(
          String(response.headers["content-type"] || ""),
        )
      ) {
        response.data.destroy();
        throw new AppError(
          "The provider returned a page instead of recording media. Check download permissions.",
          502,
          "DOWNLOAD_FAILED",
        );
      }
      const limiter = new Transform({
        transform(chunk, _encoding, done) {
          bytes += chunk.length;
          if (bytes > options.maxBytes)
            done(
              new AppError(
                "This recording exceeds the configured import size limit.",
                413,
                "IMPORT_TOO_LARGE",
              ),
            );
          else done(null, chunk);
        },
      });
      const output = fs.createWriteStream(options.destination, {
        flags: "wx",
        mode: 0o600,
      });
      output.once("open", () => {
        created = true;
      });
      await pipeline(response.data, limiter, output, { signal });
      if (!bytes)
        throw new AppError(
          "The recording file was empty.",
          502,
          "DOWNLOAD_FAILED",
        );
      return bytes;
    }
    throw new AppError(
      "The recording could not be downloaded.",
      502,
      "DOWNLOAD_FAILED",
    );
  } catch (error) {
    if (created) await fs.promises.rm(options.destination, { force: true });
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Recording download failed. Reconnect your account or try again.",
      502,
      "DOWNLOAD_FAILED",
    );
  }
}
