import { Recording } from '../database/models/Recording.js';
import { TranscriptSegment } from '../database/models/TranscriptSegment.js';
import { TranscriptChunk } from '../database/models/TranscriptChunk.js';
import { Summary } from '../database/models/Summary.js';
import { ActionItem } from '../database/models/ActionItem.js';
import { ApiUsageRecord } from '../database/models/ApiUsageRecord.js';
import { AiServiceClient } from '../services/aiServiceClient.js';
import { logger } from '../middleware/requestLogger.js';
import { randomUUID } from 'crypto';

export async function processRecordingAnalysis(recordingId: string, { retryPending = false } = {}) {
  const recording = await Recording.findById(recordingId);
  if (!recording) {
    throw new Error(`Recording ${recordingId} not found`);
  }
  if (recording.status !== 'completed') throw new Error('Wait for transcription to finish before analyzing this recording.');

  const failures: string[] = [];

  const startTime = Date.now();

  try {
    // Fetch all segments
    const segments = await TranscriptSegment.find({ recordingId })
      .sort({ segmentIndex: 1 })
      .lean();

    if (segments.length === 0) throw new Error('No transcript is available. Transcribe the recording before generating insights.');

    const fullTranscriptText = segments.map((s) => `[${s.startTime.toFixed(2)}s] ${s.speaker}: ${s.text}`).join('\n');

    // Retry only the failed stage; indexing retries must not regenerate completed checklists.
    if (recording.analysisStatus !== 'completed') {
      recording.analysisStatus = 'processing';
      recording.analysisErrorMessage = null;
      await recording.save();
      try {
        const analysis = await AiServiceClient.analyzeTranscript(
          fullTranscriptText,
          recording.title
        );

        // Update or create Summary
        const normalizedActionItems = (analysis.action_items || []).map((item: any) => ({
          text: item.text || item.task || String(item),
          assignee: item.assignee || null,
          dueDate: item.due_date || item.dueDate || null,
          due_date: item.due_date || item.dueDate || null,
          status: item.status || 'pending',
          sourceTimestamp: item.source_timestamp ?? null,
        }));

        const normalizedDecisions = (analysis.decisions || []).map((d: any) => {
          if (typeof d === 'string') {
            return { decision: d, context: null, source_timestamp: null };
          }
          return {
            decision: d.decision || d.text || String(d),
            context: d.context || null,
            source_timestamp: d.source_timestamp ?? d.sourceTimestamp ?? null,
            sourceTimestamp: d.source_timestamp ?? d.sourceTimestamp ?? null,
          };
        });

        await Summary.findOneAndUpdate(
          { recordingId },
          {
            $set: {
              recordingId,
              modelName: analysis.model || 'llama3.2',
              summaryMarkdown: analysis.summary,
              keyTakeaways: (analysis.key_takeaways || []).slice(0, 8),
              decisions: normalizedDecisions,
              topics: analysis.topics || [],
              actionItems: normalizedActionItems,
              promptTokens: analysis.prompt_tokens || 0,
              completionTokens: analysis.completion_tokens || 0,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Preserve completion and IDs for unchanged tasks, and write replacements before removing old tasks.
        const existingActions = await ActionItem.find({ recordingId }).lean();
        const taskKey = (task: string, assignee?: string | null, dueDate?: string | null) =>
          JSON.stringify([task.trim().replace(/\s+/g, ' ').toLowerCase(), assignee || '', dueDate || '']);
        const existingByTask = new Map(existingActions.map((item) => [taskKey(item.task, item.assignee, item.dueDate), item]));
        const actionDocs = normalizedActionItems.map((item) => ({
          ...item, id: existingByTask.get(taskKey(item.text, item.assignee, item.dueDate))?._id || randomUUID(),
        }));
        if (actionDocs.length) await ActionItem.bulkWrite(actionDocs.map((item) => ({ updateOne: {
          filter: { _id: item.id, recordingId, workspaceId: recording.workspaceId },
          update: {
            $set: { recordingId, workspaceId: recording.workspaceId, task: item.text, assignee: item.assignee,
              dueDate: item.dueDate, sourceTimestamp: item.sourceTimestamp },
            $setOnInsert: { status: item.status === 'completed' ? 'completed' : 'pending', priority: 'medium' },
          }, upsert: true,
        } })));
        await ActionItem.deleteMany({ recordingId, workspaceId: recording.workspaceId, _id: { $nin: actionDocs.map((item) => item.id) } });

        recording.analysisStatus = 'completed';
        recording.analysisErrorMessage = null;
        await recording.save();

        // Record usage for summary
        await ApiUsageRecord.create({
          workspaceId: recording.workspaceId,
          userId: recording.userId,
          resourceType: 'summary',
          model: analysis.model || 'llama3.2',
          promptTokens: analysis.prompt_tokens || 0,
          completionTokens: analysis.completion_tokens || 0,
          totalTokens: (analysis.prompt_tokens || 0) + (analysis.completion_tokens || 0),
          durationSeconds: (Date.now() - startTime) / 1000,
          statusCode: 200,
        });
      } catch (aiErr: any) {
        recording.analysisStatus = retryPending ? 'pending' : 'failed';
        recording.analysisErrorMessage = aiErr.message || 'AI analysis failed. Check that the model is ready and try again.';
        await recording.save();
        failures.push(recording.analysisErrorMessage!);
        logger.error({ recordingId, err: aiErr.message }, 'AI analysis summary failed');
      }
    }

    // Indexing has its own outcome and must not overwrite the analysis outcome.
    if (recording.indexStatus !== 'completed') {
      recording.indexStatus = 'indexing';
      await recording.save();
      try {
        const chunkRes = await AiServiceClient.chunkTranscript(
          segments.map((s) => ({
            start: s.startTime,
            end: s.endTime,
            speaker: s.speaker,
            text: s.text,
          }))
        );

        if (chunkRes.chunks && chunkRes.chunks.length > 0) {
          const texts = chunkRes.chunks.map((c) => c.text);
          const embedRes = await AiServiceClient.generateEmbeddings(texts);
          if (embedRes.embeddings.length !== texts.length || embedRes.embeddings.some(
            (vector) => vector.length !== embedRes.dimension || !vector.length || vector.some((value) => !Number.isFinite(value)),
          )) throw new Error('The embedding model returned incomplete passages. Retry indexing when the model is ready.');

          // Delete old chunks
          await TranscriptChunk.deleteMany({ recordingId });

          const chunkDocs = chunkRes.chunks.map((c, idx) => ({
            recordingId,
            workspaceId: recording.workspaceId,
            chunkIndex: c.chunk_index,
            startTime: c.start_time,
            endTime: c.end_time,
            speaker: c.speaker,
            text: c.text,
            tokenCount: c.token_count,
            embedding: embedRes.embeddings[idx] || [],
          }));

          await TranscriptChunk.insertMany(chunkDocs);

          // Record usage for embedding
          await ApiUsageRecord.create({
            workspaceId: recording.workspaceId,
            userId: recording.userId,
            resourceType: 'embedding',
            model: embedRes.model || 'all-MiniLM-L6-v2',
            promptTokens: chunkDocs.reduce((acc, c) => acc + (c.tokenCount || 0), 0),
            completionTokens: 0,
            totalTokens: chunkDocs.reduce((acc, c) => acc + (c.tokenCount || 0), 0),
            durationSeconds: (Date.now() - startTime) / 1000,
            statusCode: 200,
          });
        }
        recording.indexStatus = 'completed';
        await recording.save();
      } catch (embedErr: any) {
        recording.indexStatus = retryPending ? 'pending' : 'failed';
        await recording.save();
        failures.push(embedErr.message || 'Transcript indexing failed');
        logger.error({ recordingId, err: embedErr.message }, 'Vector chunking/embedding failed');
      }

    }

    if (failures.length) throw new Error(failures.join(' '));

    logger.info({ recordingId }, 'AI analysis & indexing completed successfully');
  } catch (err: any) {
    logger.error({ recordingId, err: err.message }, 'AI analysis job failed');
    if (recording.analysisStatus === 'processing' || recording.analysisStatus === 'pending' || !recording.analysisStatus) {
      recording.analysisStatus = retryPending ? 'pending' : 'failed';
      recording.analysisErrorMessage = err.message;
    }
    if (recording.indexStatus !== 'completed') recording.indexStatus = retryPending ? 'pending' : 'failed';
    await recording.save();
    throw err;
  }
}
