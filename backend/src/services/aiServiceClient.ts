import axios from 'axios';
import { config } from '../config/index.js';

const client = axios.create({
  baseURL: config.aiServiceUrl,
  timeout: 600000, // 10 minutes timeout for heavy AI tasks
});

export interface TranscribeResponse {
  language: string;
  duration: number;
  segments: Array<{
    id: number;
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
  decisions: string[];
  action_items: Array<{
    text: string;
    assignee?: string;
    due_date?: string;
    status?: string;
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
  token_count: number;
}

export interface ChunkResponse {
  chunks: ChunkItem[];
}

export interface EmbedResponse {
  embeddings: number[][];
  model: string;
  dimension: number;
}

export interface RagResponse {
  answer: string;
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
  static async checkHealth(): Promise<{ status: string; whisper_available: boolean; ollama_available: boolean; embeddings_available: boolean }> {
    const res = await client.get('/health', { timeout: 5000 });
    return res.data;
  }

  static async transcribeAudio(filePath: string, language?: string): Promise<TranscribeResponse> {
    const res = await client.post('/transcribe', {
      file_path: filePath,
      language: language || null,
    });
    return res.data;
  }

  static async analyzeTranscript(transcriptText: string, title?: string): Promise<AnalyzeResponse> {
    const res = await client.post('/analyze', {
      transcript_text: transcriptText,
      title: title || '',
    });
    return res.data;
  }

  static async chunkTranscript(
    segments: Array<{ start: number; end: number; speaker?: string; text: string }>,
    maxTokens: number = 250,
    overlapTokens: number = 40
  ): Promise<ChunkResponse> {
    const res = await client.post('/chunk', {
      segments: segments.map((s) => ({
        start: s.start,
        end: s.end,
        speaker: s.speaker || 'Speaker 1',
        text: s.text,
      })),
      max_tokens: maxTokens,
      overlap_tokens: overlapTokens,
    });
    return res.data;
  }

  static async generateEmbeddings(texts: string[]): Promise<EmbedResponse> {
    const res = await client.post('/embed', { texts });
    return res.data;
  }

  static async askQuestion(
    transcriptText: string,
    question: string,
    title?: string
  ): Promise<{ answer: string; prompt_tokens: number; completion_tokens: number }> {
    const res = await client.post('/ask', {
      transcript_text: transcriptText,
      question,
      title: title || '',
    });
    return res.data;
  }

  static async performRag(
    query: string,
    chunks: Array<{
      recording_id: string;
      recording_title?: string;
      start_time: number;
      end_time: number;
      speaker: string;
      text: string;
      embedding?: number[];
    }>,
    topK: number = 5
  ): Promise<RagResponse> {
    const res = await client.post('/rag', {
      query,
      chunks,
      top_k: topK,
    });
    return res.data;
  }
}
