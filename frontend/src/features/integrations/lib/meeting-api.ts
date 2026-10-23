import { apiClient } from "@/lib/api-client";

export type MeetingProvider = "zoom" | "google-meet" | "webex";
export interface MeetingConnection {
  provider: MeetingProvider;
  name: string;
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
  missingVariables: string[];
  callbackUrl: string;
  scopes: string[];
}
export interface MeetingImport {
  id: string;
  provider: MeetingProvider;
  externalId: string;
  title: string;
  status: "queued" | "downloading" | "imported" | "failed";
  recordingId: string | null;
  error: string | null;
  createdAt: string;
}
export interface CloudRecording {
  id: string;
  title: string;
  createdAt: string;
  durationSeconds: number;
  sizeBytes: number;
  mimeType: string;
  import: MeetingImport | null;
}
export interface CloudRecordings {
  recordings: CloudRecording[];
  nextCursor: string | null;
  maxImportSizeMb: number;
}
const base = "/meeting-integrations";
export const meetingApi = {
  connections: async () =>
    (await apiClient.get<MeetingConnection[]>(base)).data,
  imports: async () =>
    (await apiClient.get<MeetingImport[]>(`${base}/imports`)).data,
  connect: async (provider: MeetingProvider) =>
    (
      await apiClient.post<{ authorizeUrl: string }>(
        `${base}/${provider}/connect`,
        {},
        { credentials: "include" },
      )
    ).data,
  disconnect: (provider: MeetingProvider) =>
    apiClient.delete(`${base}/${provider}/connection`),
  recordings: async (
    provider: MeetingProvider,
    cursor?: string,
    folderId?: string,
  ) => {
    const query = new URLSearchParams();
    if (cursor) query.set("cursor", cursor);
    if (folderId) query.set("folderId", folderId);
    return (
      await apiClient.get<CloudRecordings>(
        `${base}/${provider}/recordings?${query}`,
      )
    ).data;
  },
  import: async (provider: MeetingProvider, recordingId: string) =>
    (
      await apiClient.post<MeetingImport>(`${base}/${provider}/imports`, {
        recordingId,
      })
    ).data,
};
