import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { Recording } from '../../database/models/Recording.js';
import { TranscriptChunk } from '../../database/models/TranscriptChunk.js';
import { TranscriptSegment } from '../../database/models/TranscriptSegment.js';
import { ApiUsageRecord } from '../../database/models/ApiUsageRecord.js';
import { AiServiceClient } from '../../services/aiServiceClient.js';
import { escapeSearch } from '../../utils/search.js';
import { AppError } from '../../middleware/errorHandler.js';

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class SearchController {
  static async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspaceId!;
      // Support both query param (GET) and body (POST)
      const query = (req.body?.query || req.query.q || req.query.query || '') as string;
      const recordingId = (req.body?.recording_id || req.body?.recordingId || req.query.recording_id || req.query.recordingId) as string | undefined;
      const recordingIds = req.body?.recording_ids || req.body?.recordingIds;
      const collectionId = (req.body?.collection_id || req.body?.collectionId || req.query.collection_id || req.query.collectionId) as string | undefined;
      const limit = Number(req.body?.limit || req.query.limit) || 10;
      const minScore = Number(req.body?.min_score ?? req.query.min_score ?? 0.2);
      const mode = (req.body?.mode || req.query.mode || 'hybrid') as 'hybrid' | 'semantic' | 'keyword';

      if (!query.trim()) {
        const emptyPayload = { query: '', mode, total: 0, results: [] };
        return res.json({ success: true, message: 'Search completed', data: emptyPayload, ...emptyPayload });
      }

      // Find eligible recordings for this workspace
      const recFilter: any = { workspaceId };
      if (recordingId) {
        recFilter._id = recordingId;
      } else if (recordingIds && Array.isArray(recordingIds) && recordingIds.length > 0) {
        recFilter._id = { $in: recordingIds };
      }
      if (collectionId) {
        recFilter.collectionId = collectionId;
      }

      const recordings = await Recording.find(recFilter).select('_id title').lean();
      if (recordings.length === 0) {
        const emptyPayload = { query, mode, total: 0, results: [] };
        return res.json({ success: true, message: 'No matching recordings', data: emptyPayload, ...emptyPayload });
      }

      const recordingMap = new Map(recordings.map((r) => [r._id, r.title]));
      const targetRecordingIds = recordings.map((r) => r._id);

      // 1. Fetch chunks for semantic search
      const chunks = await TranscriptChunk.find({
        workspaceId,
        recordingId: { $in: targetRecordingIds },
      }).limit(10000).lean();

      let rankedResults: Array<{
        chunk_id: string;
        recording_id: string;
        recording_title: string;
        chunk_index: number;
        start_time: number;
        end_time: number;
        speaker: string;
        text: string;
        score: number;
        similarity: number;
        source_segment_ids: string[];
      }> = [];

      if (chunks.length > 0 && chunks.some((c) => c.embedding && c.embedding.length > 0)) {
        try {
          const embedRes = await AiServiceClient.generateEmbeddings([query]);
          const queryEmbedding = embedRes.embeddings[0];

          if (queryEmbedding && queryEmbedding.length > 0) {
            rankedResults = chunks
              .map((c) => {
                const sim = c.embedding && c.embedding.length === queryEmbedding.length
                  ? cosineSimilarity(queryEmbedding, c.embedding)
                  : 0;
                return {
                  chunk_id: c._id,
                  recording_id: c.recordingId,
                  recording_title: recordingMap.get(c.recordingId) || 'Untitled Recording',
                  chunk_index: c.chunkIndex,
                  start_time: c.startTime,
                  end_time: c.endTime,
                  speaker: c.speaker,
                  text: c.text,
                  score: Math.round(sim * 1000) / 1000,
                  similarity: Math.round(sim * 1000) / 1000,
                  source_segment_ids: [],
                };
              })
              .filter((r) => r.similarity >= minScore)
              .sort((a, b) => b.similarity - a.similarity)
              .slice(0, limit);
          }
        } catch (_aiErr) {}
      }

      // Keyword match fallback
      if (rankedResults.length < limit) {
        const keywordMatches = await TranscriptSegment.find({
          recordingId: { $in: targetRecordingIds },
          text: { $regex: escapeSearch(query), $options: 'i' },
        })
          .limit(limit - rankedResults.length)
          .lean();

        for (const match of keywordMatches) {
          if (!rankedResults.some((r) => r.recording_id === match.recordingId && r.text.includes(match.text))) {
            rankedResults.push({
              chunk_id: match._id,
              recording_id: match.recordingId,
              recording_title: recordingMap.get(match.recordingId) || 'Untitled Recording',
              chunk_index: match.segmentIndex,
              start_time: match.startTime,
              end_time: match.endTime,
              speaker: match.speaker,
              text: match.text,
              score: 0.5,
              similarity: 0.5,
              source_segment_ids: [match._id],
            });
          }
        }
      }

      const searchPayload = {
        query,
        mode,
        total: rankedResults.length,
        results: rankedResults,
      };

      return res.json({
        success: true,
        message: 'Search completed successfully',
        data: searchPayload,
        ...searchPayload,
      });
    } catch (error) {
      next(error);
    }
  }

  static async askKnowledge(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const workspaceId = req.workspaceId!;
      const question = req.body.query || req.body.question;
      const recordingIds = req.body.recording_ids || req.body.recordingIds;
      const collectionId = req.body.collection_id || req.body.collectionId;
      const topK = req.body.top_k || req.body.max_passages || 5;

      if (!question || !question.trim()) {
        throw new AppError('Question is required', 400, 'QUESTION_REQUIRED');
      }

      const recFilter: any = { workspaceId };
      if (recordingIds && Array.isArray(recordingIds) && recordingIds.length > 0) {
        recFilter._id = { $in: recordingIds };
      }
      if (collectionId) {
        recFilter.collectionId = collectionId;
      }

      const recordings = await Recording.find(recFilter).select('_id title').lean();
      if (recordings.length === 0) {
        const emptyPayload = {
          answer: 'No relevant recordings found in your workspace.',
          citations: [],
          sources: [],
          sufficient_evidence: false,
          recordings_searched: [],
          model_name: 'llama3.2',
        };
        return res.json({ success: true, message: 'Q&A completed', data: emptyPayload, ...emptyPayload });
      }

      const recordingMap = new Map(recordings.map((r) => [r._id, r.title]));
      const targetRecordingIds = recordings.map((r) => r._id);

      let chunks = await TranscriptChunk.find({
        workspaceId,
        recordingId: { $in: targetRecordingIds },
      }).limit(10000).lean();

      if (chunks.length === 0) {
        const segments = await TranscriptSegment.find({
          recordingId: { $in: targetRecordingIds },
        })
          .limit(50)
          .lean();

        chunks = segments.map((s, idx) => ({
          _id: s._id,
          recordingId: s.recordingId,
          workspaceId,
          chunkIndex: idx,
          startTime: s.startTime,
          endTime: s.endTime,
          speaker: s.speaker,
          text: s.text,
          tokenCount: 20,
          embedding: [],
          createdAt: new Date(),
        })) as any;
      }

      const preparedChunks = chunks.slice(0, topK).map((c) => ({
        recording_id: c.recordingId,
        recording_title: recordingMap.get(c.recordingId) || 'Untitled Recording',
        start_time: c.startTime,
        end_time: c.endTime,
        speaker: c.speaker,
        text: c.text,
        embedding: c.embedding || [],
      }));

      const startTime = Date.now();
      const ragRes = await AiServiceClient.performRag(question, preparedChunks, topK);
      const durationSeconds = (Date.now() - startTime) / 1000;

      await ApiUsageRecord.create({
        workspaceId,
        userId: req.user?._id || null,
        apiKeyId: req.apiKey?._id || null,
        resourceType: 'qa',
        model: 'llama3.2',
        promptTokens: ragRes.prompt_tokens || 0,
        completionTokens: ragRes.completion_tokens || 0,
        totalTokens: (ragRes.prompt_tokens || 0) + (ragRes.completion_tokens || 0),
        durationSeconds,
        statusCode: 200,
      });

      const citations = ragRes.sources.map((s) => ({
        recording_id: s.recording_id,
        recording_title: s.recording_title || recordingMap.get(s.recording_id) || 'Untitled Recording',
        chunk_id: s.recording_id,
        start_time: s.start_time,
        end_time: s.end_time,
        speaker: s.speaker,
        quote: s.text,
        score: s.similarity,
      }));

      const payload = {
        query: question,
        question,
        answer: ragRes.answer,
        citations,
        sources: ragRes.sources,
        sufficient_evidence: ragRes.sources.length > 0,
        recordings_searched: Array.from(new Set(ragRes.sources.map((s) => s.recording_id))),
        model_name: 'llama3.2',
        confidence: ragRes.confidence,
        prompt_tokens: ragRes.prompt_tokens,
        completion_tokens: ragRes.completion_tokens,
      };

      return res.json({
        success: true,
        message: 'Knowledge question answered',
        data: payload,
        ...payload,
      });
    } catch (error) {
      next(error);
    }
  }
}
