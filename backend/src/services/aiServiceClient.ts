import axios from 'axios';
import path from 'path';
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

const client = axios.create({
  baseURL: config.aiServiceUrl,
  timeout: 600000, // 10 minutes timeout for heavy AI tasks
  headers: { 'X-AI-Internal-Key': config.aiInternalSecret },
  maxRedirects: 0,
});

client.interceptors.response.use(undefined, (error: unknown) => {
  const detail = axios.isAxiosError(error) ? error.response?.data?.detail : null;
  const message = typeof detail === 'string' ? detail :
    'The AI service could not finish this request. Check that the service and its models are ready, then try again.';
  return Promise.reject(new AppError(message, 503, 'AI_SERVICE_UNAVAILABLE'));
});

export interface TranscribeResponse {
  language: string;
  duration: number;
  segments: Array<{
    id?: number;
    start: number;
    end: number;
    text: string;
    speaker?: string;
    confidence?: number;
  }>;
}

export interface AnalyzeResponse {
  summary: string;
  key_takeaways: string[];
  decisions: Array<{ decision: string; context?: string; source_timestamp?: number } | string>;
  action_items: Array<{
    task?: string;
    text?: string;
    assignee?: string;
    due_date?: string;
    completed?: boolean;
    status?: string;
    source_timestamp?: number | null;
  }>;
  topics: string[];
  prompt_tokens: number;
  completion_tokens: number;
  model: string;
}

export interface ChunkItem {
  chunk_index: number;
  start_time: number;
  end_time: number;
  speaker: string;
  text: string;
  source_segment_ids?: string[];
  content_hash?: string;
  token_count?: number;
}

export interface ChunkResponse {
  chunks: ChunkItem[];
}

export interface EmbedResponse {
  embeddings: number[][];
  model_name?: string;
  model?: string;
  dimension: number;
}

export interface RagResponse {
  answer: string;
  citations?: Array<{
    recording_id: string;
    recording_title: string;
    chunk_id: string;
    start_time: number;
    end_time: number;
    speaker: string;
    quote: string;
    score: number;
  }>;
  sources: Array<{
    recording_id: string;
    recording_title?: string;
    start_time: number;
    end_time: number;
    speaker: string;
    text: string;
    similarity: number;
  }>;
  confidence: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export class AiServiceClient {
  static async checkHealth(): Promise<{
    status: string;
    whisper_available: boolean;
    ollama_available: boolean;
    embeddings_available: boolean;
  }> {
    const res = await client.get('/health', { timeout: 5000 });
    const data = res.data;
    const services = data.services || {};
    return {
      status: data.status || 'unknown',
      whisper_available: services.whisper?.status === 'healthy',
      ollama_available: services.ollama?.status === 'healthy',
      embeddings_available: services.embedding?.status === 'healthy',
    };
  }

  static async transcribeAudio(filePath: string, language?: string): Promise<TranscribeResponse> {
    const resolvedPath = path.resolve(filePath);
    const res = await client.post('/transcribe', {
      audio_path: resolvedPath,
      file_path: resolvedPath,
      language: language || null,
    });
    return res.data;
  }

  static async analyzeTranscript(transcriptText: string, title?: string): Promise<AnalyzeResponse> {
    const res = await client.post('/analyze', {
      transcript_text: transcriptText,
      title: title || '',
    });
    const d = res.data;
    return {
      summary: d.summary || '',
      key_takeaways: d.key_takeaways || [],
      decisions: d.decisions || [],
      action_items: (d.action_items || []).map((item: any) => ({
        text: item.task || item.text || '',
        task: item.task || item.text || '',
        assignee: item.assignee || null,
        due_date: item.due_date || null,
        status: item.completed ? 'completed' : 'pending',
        source_timestamp: item.source_timestamp ?? null,
      })),
      topics: d.topics || [],
      prompt_tokens: d.prompt_tokens || 0,
      completion_tokens: d.completion_tokens || 0,
      model: d.model_name || 'llama3.2',
    };
  }

  static async chunkTranscript(
    segments: Array<{ start: number; end: number; speaker?: string; text: string }>,
    targetWords: number = 180,
    overlapWords: number = 35
  ): Promise<ChunkResponse> {
    const res = await client.post('/chunk', {
      segments: segments.map((s) => ({
        start: s.start,
        end: s.end,
        speaker: s.speaker || 'Speaker 1',
        text: s.text,
      })),
      target_words: targetWords,
      overlap_words: overlapWords,
      max_tokens: Math.round(targetWords / 0.75),
      overlap_tokens: Math.round(overlapWords / 0.75),
    });
    return res.data;
  }

  static async generateEmbeddings(texts: string[]): Promise<EmbedResponse> {
    const res = await client.post('/embed', { texts });
    return {
      embeddings: res.data.embeddings,
      dimension: res.data.dimension,
      model: res.data.model_name || 'all-MiniLM-L6-v2',
      model_name: res.data.model_name || 'all-MiniLM-L6-v2',
    };
  }

  static async askQuestion(
    transcriptText: string,
    question: string,
    title?: string
  ): Promise<{ answer: string; supported_by_transcript: boolean; timestamps: number[]; model_name: string; prompt_tokens: number; completion_tokens: number }> {
    const res = await client.post('/ask', {
      transcript_text: transcriptText,
      question,
      title: title || '',
    });
    return {
      answer: res.data.answer || '',
      supported_by_transcript: res.data.supported_by_transcript === true,
      timestamps: res.data.timestamps || [],
      model_name: res.data.model_name || 'llama3.2',
      prompt_tokens: res.data.prompt_tokens || 0,
      completion_tokens: res.data.completion_tokens || 0,
    };
  }

  static async performRag(
    question: string,
    chunksOrPassages: Array<{
      recording_id: string;
      recording_title?: string;
      chunk_id?: string;
      start_time: number;
      end_time: number;
      speaker: string;
      text: string;
      similarity?: number;
      score?: number;
    }>,
    _topK: number = 5
  ): Promise<RagResponse> {
    const passages = chunksOrPassages.map((c) => ({
      recording_id: c.recording_id,
      recording_title: c.recording_title || 'Untitled Recording',
      chunk_id: c.chunk_id || c.recording_id,
      start_time: c.start_time,
      end_time: c.end_time,
      speaker: c.speaker,
      text: c.text,
      score: c.score !== undefined ? c.score : c.similarity !== undefined ? c.similarity : 0.5,
    }));

    const res = await client.post('/rag', {
      question,
      query: question,
      passages,
      chunks: passages,
    });

    const d = res.data;
    const sources =
      d.sources ||
      (d.citations || []).map((c: any) => ({
        recording_id: c.recording_id,
        recording_title: c.recording_title,
        start_time: c.start_time,
        end_time: c.end_time,
        speaker: c.speaker,
        text: c.quote,
        similarity: c.score,
      }));

    return {
      answer: d.answer,
      citations: d.citations,
      sources,
      confidence: d.confidence ?? 0.95,
      prompt_tokens: d.prompt_tokens || 0,
      completion_tokens: d.completion_tokens || 0,
    };
  }
}
