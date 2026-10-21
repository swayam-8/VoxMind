/**
 * VoxMind Realistic Demo Fixtures & Local Interactive Store
 * Explicitly labeled as demo data for visual design and interface verification
 * before production backend connection.
 */

export interface DemoTranscriptSegment {
  id: string
  startTime: number
  endTime: number
  speaker: string
  text: string
  confidence: number
}

export interface DemoActionItem {
  id: string
  task: string
  assignee: string
  dueDate: string
  completed: boolean
  sourceTimestamp: number
}

export interface DemoDecision {
  id: string
  decision: string
  context: string
  sourceTimestamp: number
}

export interface DemoInsight {
  summaryMarkdown: string
  decisions: DemoDecision[]
  actionItems: DemoActionItem[]
  topics: string[]
  modelUsed: string
}

export interface DemoRecording {
  id: string
  title: string
  filename: string
  fileSizeBytes: number
  durationSeconds: number
  mimeType: string
  status: "ready" | "transcribing" | "queued" | "failed"
  errorMessage?: string | null
  collectionId: string
  collectionName: string
  createdAt: string
  audioUrl?: string
  segments: DemoTranscriptSegment[]
  insight: DemoInsight
}

export interface DemoCollection {
  id: string
  name: string
  description: string
  color: string
  recordingCount: number
  createdAt: string
}

export interface DemoApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  status: "active" | "revoked"
}

export const DEMO_COLLECTIONS: DemoCollection[] = [
  {
    id: "col-1",
    name: "Product & Architecture",
    description: "Core roadmap, tech debt evaluations, and infrastructure decisions.",
    color: "#8B5CF6", // Violet
    recordingCount: 4,
    createdAt: "2026-10-15T10:00:00Z",
  },
  {
    id: "col-2",
    name: "Customer & User Research",
    description: "Interviews, feedback sessions, and UX discovery calls.",
    color: "#10B981", // Emerald
    recordingCount: 2,
    createdAt: "2026-10-18T14:30:00Z",
  },
  {
    id: "col-3",
    name: "Sprint Syncs",
    description: "Weekly standups and sprint planning discussions.",
    color: "#3B82F6", // Blue
    recordingCount: 1,
    createdAt: "2026-10-20T09:00:00Z",
  },
]

export const DEMO_RECORDINGS: DemoRecording[] = [
  {
    id: "rec-01",
    title: "Q4 Voice Engine Architecture & Latency Benchmark",
    filename: "eng_arch_q4_sync.mp3",
    fileSizeBytes: 24_680_000,
    durationSeconds: 1124, // ~18m 44s
    mimeType: "audio/mpeg",
    status: "ready",
    collectionId: "col-1",
    collectionName: "Product & Architecture",
    createdAt: "2026-10-21T09:15:00Z",
    segments: [
      {
        id: "seg-1",
        startTime: 0.0,
        endTime: 6.8,
        speaker: "Elena Vance (Platform Lead)",
        text: "Let's review the memory footprint benchmarks for faster-whisper int8 quantization against our baseline on the GPU cluster.",
        confidence: 0.98,
      },
      {
        id: "seg-2",
        startTime: 7.2,
        endTime: 16.4,
        speaker: "Marcus Thorne (Staff ML Eng)",
        text: "With int8 compute on standard CPU nodes, we achieved a 2.8x speedup over PyTorch FP16 while maintaining a Word Error Rate under 4.2%.",
        confidence: 0.97,
      },
      {
        id: "seg-3",
        startTime: 17.0,
        endTime: 25.5,
        speaker: "Elena Vance (Platform Lead)",
        text: "That confirms we can safely default to local CPU transcription for users running without dedicated NVIDIA hardware.",
        confidence: 0.99,
      },
      {
        id: "seg-4",
        startTime: 26.2,
        endTime: 38.0,
        speaker: "Devon Reed (Audio Architect)",
        text: "Agreed. I also tested the chunking pipeline. By splitting at silent pauses longer than 600 milliseconds, we eliminate hallucinations entirely on non-speech segments.",
        confidence: 0.96,
      },
      {
        id: "seg-5",
        startTime: 38.8,
        endTime: 49.3,
        speaker: "Marcus Thorne (Staff ML Eng)",
        text: "Next step is connecting Ollama's structured output schema to parse decisions and action items immediately after the transcription worker completes.",
        confidence: 0.98,
      },
      {
        id: "seg-6",
        startTime: 50.1,
        endTime: 62.0,
        speaker: "Elena Vance (Platform Lead)",
        text: "Let's lock that in. Devon will standardize the pause detection threshold, and Marcus will finalize the Ollama JSON extractor.",
        confidence: 0.99,
      },
    ],
    insight: {
      summaryMarkdown:
        "The team evaluated **faster-whisper int8 quantization** on standard CPU infrastructure, confirming a **2.8x throughput increase** with negligible accuracy degradation (<4.2% WER). Devon validated silence-based chunking (>600ms pauses) to eliminate hallucinated segments, and the team committed to integrating Ollama structured schema extraction into the post-transcription Celery worker.",
      decisions: [
        {
          id: "dec-1",
          decision: "Default to int8 quantized faster-whisper on CPU for non-GPU host environments.",
          context: "Yields 2.8x speedup and prevents GPU-out-of-memory bottlenecks on desktop installations.",
          sourceTimestamp: 17.0,
        },
        {
          id: "dec-2",
          decision: "Set silence boundary detection to 600ms before chunk dispatching.",
          context: "Prevents whisper hallucinations over ambient noise or microphone breathing intervals.",
          sourceTimestamp: 26.2,
        },
      ],
      actionItems: [
        {
          id: "act-1",
          task: "Standardize 600ms silence detection filter in audio normalization service",
          assignee: "Devon Reed",
          dueDate: "2026-10-24",
          completed: false,
          sourceTimestamp: 50.1,
        },
        {
          id: "act-2",
          task: "Implement Ollama structured JSON extraction schema for insights pipeline",
          assignee: "Marcus Thorne",
          dueDate: "2026-10-25",
          completed: true,
          sourceTimestamp: 38.8,
        },
      ],
      topics: ["faster-whisper", "quantization", "latency benchmarks", "Ollama", "audio chunking"],
      modelUsed: "llama3.2:3b (local inference)",
    },
  },
  {
    id: "rec-02",
    title: "Customer Discovery Interview: Enterprise Compliance Lead",
    filename: "customer_interview_compliance.wav",
    fileSizeBytes: 48_100_000,
    durationSeconds: 1840, // ~30m 40s
    mimeType: "audio/wav",
    status: "ready",
    collectionId: "col-2",
    collectionName: "Customer & User Research",
    createdAt: "2026-10-20T16:45:00Z",
    segments: [
      {
        id: "seg-201",
        startTime: 0.0,
        endTime: 8.5,
        speaker: "Sarah Jenkins (Interviewer)",
        text: "Thank you for joining. Today we want to understand your exact requirements regarding data residency and local audio storage.",
        confidence: 0.99,
      },
      {
        id: "seg-202",
        startTime: 9.0,
        endTime: 21.4,
        speaker: "David Kim (VP Compliance, FinTech)",
        text: "Our core constraint is simple: no raw audio or identifiable transcripts may ever leave our self-hosted VPC perimeter. Cloud API proxies are an immediate audit failure.",
        confidence: 0.97,
      },
      {
        id: "seg-203",
        startTime: 22.0,
        endTime: 34.2,
        speaker: "Sarah Jenkins (Interviewer)",
        text: "Understood. That aligns with our local-first architecture where the models run on-premise without external telemetry or data telemetry.",
        confidence: 0.98,
      },
    ],
    insight: {
      summaryMarkdown:
        "Enterprise compliance interview with David Kim highlighting strict data residency demands. Cloud-relayed speech-to-text APIs are non-compliant for their compliance audits, making self-contained local AI deployment an absolute prerequisite.",
      decisions: [
        {
          id: "dec-201",
          decision: "Ensure total air-gapped compatibility without external phoning home.",
          context: "Required by enterprise financial and healthcare compliance mandates.",
          sourceTimestamp: 9.0,
        },
      ],
      actionItems: [
        {
          id: "act-201",
          task: "Document air-gapped Docker deployment guide for compliance auditors",
          assignee: "Sarah Jenkins",
          dueDate: "2026-10-28",
          completed: false,
          sourceTimestamp: 22.0,
        },
      ],
      topics: ["air-gapped", "data residency", "compliance", "self-hosted"],
      modelUsed: "llama3.2:3b (local inference)",
    },
  },
  {
    id: "rec-03",
    title: "Weekly Engineering Standup & Sprint 14 Handoff",
    filename: "standup_sprint14_audio.m4a",
    fileSizeBytes: 12_400_000,
    durationSeconds: 612, // ~10m 12s
    mimeType: "audio/mp4",
    status: "transcribing",
    collectionId: "col-3",
    collectionName: "Sprint Syncs",
    createdAt: "2026-10-21T18:00:00Z",
    segments: [],
    insight: {
      summaryMarkdown: "Processing in progress...",
      decisions: [],
      actionItems: [],
      topics: ["sprint-14", "standup"],
      modelUsed: "queued",
    },
  },
  {
    id: "rec-04",
    title: "Executive Board Update: AI Product Roadmap 2027",
    filename: "exec_board_recording_draft.wav",
    fileSizeBytes: 31_200_000,
    durationSeconds: 1420,
    mimeType: "audio/wav",
    status: "queued",
    collectionId: "col-1",
    collectionName: "Product & Architecture",
    createdAt: "2026-10-21T21:10:00Z",
    segments: [],
    insight: {
      summaryMarkdown: "Awaiting transcription worker slot...",
      decisions: [],
      actionItems: [],
      topics: ["roadmap", "executive"],
      modelUsed: "queued",
    },
  },
]

export const DEMO_API_KEYS: DemoApiKey[] = [
  {
    id: "key-1",
    name: "Internal CI/CD Pipeline Key",
    prefix: "vm_live_9a4f...",
    createdAt: "2026-10-18T11:20:00Z",
    lastUsedAt: "2026-10-21T19:42:00Z",
    status: "active",
  },
  {
    id: "key-2",
    name: "Desktop Client Ingestion Key",
    prefix: "vm_live_3c8e...",
    createdAt: "2026-10-19T08:15:00Z",
    lastUsedAt: "2026-10-21T14:10:00Z",
    status: "active",
  },
]
