/**
 * Core VoxMind Domain Type Definitions
 */

export type RecordingStatus =
  | "queued"
  | "processing"
  | "transcribing"
  | "summarizing"
  | "completed"
  | "ready"
  | "failed"

export interface User {
  id: string
  email: string
  fullName: string
  role: string
  createdAt: string
}

export interface Collection {
  id: string
  name: string
  description?: string
  color?: string
  recordingCount?: number
  createdAt: string
}

export interface TranscriptSegment {
  id: string
  segment_index?: number
  start_time?: number
  end_time?: number
  startTime?: number
  endTime?: number
  text: string
  confidence?: number
  speaker?: string
}

export interface ActionItem {
  id: string
  task: string
  assignee?: string
  dueDate?: string
  completed: boolean
  sourceTimestamp?: number
}

export interface DecisionItem {
  id: string
  decision: string
  context?: string
  sourceTimestamp?: number
}

export interface Insight {
  id: string
  recordingId: string
  summaryMarkdown: string
  decisions: DecisionItem[]
  actionItems: ActionItem[]
  topics: string[]
  modelUsed: string
  createdAt: string
}

export interface Recording {
  id: string
  title: string
  filename: string
  fileSizeBytes: number
  durationSeconds: number
  mimeType: string
  status: RecordingStatus
  errorMessage?: string | null
  collectionId?: string | null
  collection?: Collection | null
  createdAt: string
  updatedAt: string
}

export interface SystemServiceHealth {
  status: "healthy" | "degraded" | "unreachable" | "unconfigured"
  latencyMs?: number
  details?: Record<string, unknown>
  message?: string
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy"
  timestamp: string
  environment: string
  services: {
    database: SystemServiceHealth
    redis: SystemServiceHealth
    celery: SystemServiceHealth
    ollama: SystemServiceHealth
    whisper: SystemServiceHealth
  }
}
