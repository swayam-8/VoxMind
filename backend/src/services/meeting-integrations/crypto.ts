import crypto from "node:crypto";
import { AppError } from "../../middleware/errorHandler.js";

export function encryptionKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY || "";
  if (!/^[a-f\d]{64}$/i.test(raw)) {
    throw new AppError(
      "Configure INTEGRATION_ENCRYPTION_KEY before connecting meeting accounts.",
      503,
      "INTEGRATION_NOT_CONFIGURED",
    );
  }
  return Buffer.from(raw, "hex");
}

export function seal(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function unseal<T>(value: string): T {
  try {
    const [iv, tag, encrypted] = value
      .split(".")
      .map((part) => Buffer.from(part, "base64url"));
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      iv,
    );
    decipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
        "utf8",
      ),
    );
  } catch {
    throw new AppError(
      "Meeting credentials could not be read. Check the encryption key or reconnect your account.",
      401,
      "PROVIDER_RECONNECT_REQUIRED",
    );
  }
}
export function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
