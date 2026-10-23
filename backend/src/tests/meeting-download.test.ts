import { beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import axios from "axios";
import { Readable } from "node:stream";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import {
  downloadRecording,
  validateDownloadUrl,
} from "../services/meeting-integrations/download.js";
import { seal, unseal } from "../services/meeting-integrations/crypto.js";

vi.mock("axios", () => ({ default: { request: vi.fn() } }));
const http = vi.mocked(axios.request);
const directory = await fs.mkdtemp(
  path.join(os.tmpdir(), "voxmind-download-test-"),
);
const destination = () => path.join(directory, crypto.randomUUID());
const stream = (data: string, headers: any = {}) => ({
  status: 200,
  headers: { "content-type": "audio/mp4", ...headers },
  data: Readable.from([Buffer.from(data)]),
});
beforeEach(() => http.mockReset());
afterAll(async () => fs.rm(directory, { recursive: true, force: true }));

describe("Bounded provider media downloads", () => {
  it.each([
    "http://zoom.us/file",
    "https://zoom.us.evil.example/file",
    "https://127.0.0.1/file",
    "https://zoom.us:8443/file",
    "https://user:password@zoom.us/file",
  ])("rejects unsafe URL %s", (url) => {
    expect(() => validateDownloadUrl(url, "zoom")).toThrow();
  });
  it("streams bytes to a private file", async () => {
    const target = destination();
    http.mockResolvedValueOnce(stream("audio bytes"));
    expect(
      await downloadRecording({
        url: "https://us02web.zoom.us/file",
        provider: "zoom",
        destination: target,
        token: "fixture-token",
        maxBytes: 100,
      }),
    ).toBe(11);
    expect(await fs.readFile(target, "utf8")).toBe("audio bytes");
    expect((await fs.stat(target)).mode & 0o777).toBe(0o600);
  });
  it("strips Authorization on cross-origin redirects", async () => {
    http.mockResolvedValueOnce({
      status: 302,
      headers: { location: "https://other.zoom.us/file" },
      data: Readable.from([]),
    });
    http.mockResolvedValueOnce(stream("audio"));
    await downloadRecording({
      url: "https://zoom.us/file",
      provider: "zoom",
      destination: destination(),
      token: "fixture-token",
      maxBytes: 100,
    });
    expect(http.mock.calls[0][0].headers).toEqual({
      Authorization: "Bearer fixture-token",
    });
    expect(http.mock.calls[1][0].headers).toEqual({});
  });
  it("blocks a redirect to private or unrelated destinations before a second request", async () => {
    http.mockResolvedValueOnce({
      status: 302,
      headers: { location: "https://127.0.0.1/internal" },
      data: Readable.from([]),
    });
    await expect(
      downloadRecording({
        url: "https://zoom.us/file",
        provider: "zoom",
        destination: destination(),
        maxBytes: 100,
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_DOWNLOAD" });
    expect(http).toHaveBeenCalledTimes(1);
  });
  it("enforces the streamed limit even without Content-Length and removes partial files", async () => {
    const target = destination();
    http.mockResolvedValueOnce(stream("too many bytes"));
    await expect(
      downloadRecording({
        url: "https://zoom.us/file",
        provider: "zoom",
        destination: target,
        maxBytes: 3,
      }),
    ).rejects.toMatchObject({ code: "IMPORT_TOO_LARGE" });
    await expect(fs.stat(target)).rejects.toThrow();
  });
  it("rejects login pages and oversized declared files", async () => {
    http.mockResolvedValueOnce(
      stream("login", { "content-type": "text/html" }),
    );
    await expect(
      downloadRecording({
        url: "https://zoom.us/file",
        provider: "zoom",
        destination: destination(),
        maxBytes: 100,
      }),
    ).rejects.toMatchObject({ code: "DOWNLOAD_FAILED" });
    http.mockResolvedValueOnce(stream("audio", { "content-length": "1000" }));
    await expect(
      downloadRecording({
        url: "https://zoom.us/file",
        provider: "zoom",
        destination: destination(),
        maxBytes: 100,
      }),
    ).rejects.toMatchObject({ code: "IMPORT_TOO_LARGE" });
  });
  it("never overwrites or deletes an existing destination", async () => {
    const target = destination();
    await fs.writeFile(target, "keep existing");
    http.mockResolvedValueOnce(stream("new audio"));
    await expect(
      downloadRecording({
        url: "https://zoom.us/file",
        provider: "zoom",
        destination: target,
        maxBytes: 100,
      }),
    ).rejects.toThrow();
    expect(await fs.readFile(target, "utf8")).toBe("keep existing");
  });
  it("encrypts credentials and detects ciphertext tampering", () => {
    vi.stubEnv(
      "INTEGRATION_ENCRYPTION_KEY",
      crypto.randomBytes(32).toString("hex"),
    );
    const encrypted = seal({ token: "fixture-access-token" });
    expect(encrypted).not.toContain("fixture-access-token");
    expect(unseal(encrypted)).toEqual({ token: "fixture-access-token" });
    const parts = encrypted.split(".");
    const bytes = Buffer.from(parts[2], "base64url");
    bytes[0] ^= 1;
    parts[2] = bytes.toString("base64url");
    expect(() => unseal(parts.join("."))).toThrow();
    vi.unstubAllEnvs();
  });
});
