import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../database/connection.js';
import { Recording } from '../database/models/Recording.js';
import { TranscriptSegment } from '../database/models/TranscriptSegment.js';
import { Summary } from '../database/models/Summary.js';
import { ActionItem } from '../database/models/ActionItem.js';
import { AiServiceClient, type AnalyzeResponse } from '../services/aiServiceClient.js';
import { processRecordingAnalysis } from '../services/recordingAnalysis.js';
import { aiQueue, processAiJob, type AiJobData } from '../queues/aiQueue.js';
import type { Job } from 'bullmq';
import { RecordingQuestion } from '../database/models/RecordingQuestion.js';
import { randomUUID } from 'crypto';

const app = createApp();
let mongo: MongoMemoryServer;
let token: string;
let workspaceId: string;
let userId: string;
let recordingId: string;
const analysis: AnalyzeResponse = {
  summary: 'The team approved Friday’s release. Alex will send the checklist.',
  decisions: [{ decision: 'Release on Friday', context: 'Testing is complete', source_timestamp: 0 }],
  action_items: [{ task: 'Send release checklist', assignee: 'Alex', due_date: 'Thursday', source_timestamp: 0 }],
  key_takeaways: ['Release approved'], topics: ['Release'], model: 'local-test-model', prompt_tokens: 10, completion_tokens: 20,
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
  const response = await request(app).post('/api/v1/auth/register').send({
    email: 'analysis-tests@example.test', password: 'Analysis-tests-password-123', fullName: 'Analysis Tests',
  });
  token = response.body.access_token;
  workspaceId = response.body.workspace.id;
  userId = response.body.user.id;
});

afterAll(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});

beforeEach(async () => {
  const recording = await Recording.create({
    workspaceId, userId, title: 'Release meeting', filename: 'meeting.wav', storagePath: `/tmp/${randomUUID()}.wav`,
    status: 'completed', analysisStatus: 'pending', indexStatus: 'pending',
  });
  recordingId = recording._id;
  await TranscriptSegment.create({ recordingId, segmentIndex: 0, startTime: 0, endTime: 15, speaker: 'Alex', text: 'We agreed to release on Friday. I will send the checklist by Thursday.' });
  vi.spyOn(AiServiceClient, 'analyzeTranscript').mockResolvedValue(structuredClone(analysis));
  vi.spyOn(AiServiceClient, 'chunkTranscript').mockResolvedValue({ chunks: [{ chunk_index: 0, start_time: 0, end_time: 15, speaker: 'Alex', text: 'Release on Friday.', token_count: 4 }] });
  vi.spyOn(AiServiceClient, 'generateEmbeddings').mockResolvedValue({ embeddings: [Array(384).fill(0.1)], dimension: 384 });
});
afterEach(() => vi.restoreAllMocks());

const detail = () => request(app).get(`/api/v1/recordings/${recordingId}`).set('Authorization', `Bearer ${token}`);

describe('recording insights lifecycle', () => {
  it('keeps automatic retries pending until the final attempt fails', async () => {
    vi.mocked(AiServiceClient.analyzeTranscript).mockRejectedValue(new Error('Model unavailable'));
    const job = { data: { recordingId }, id: 'retry-test', opts: { attempts: 3 }, attemptsMade: 0 } as Job<AiJobData>;
    await expect(processAiJob(job)).rejects.toThrow('Model unavailable');
    expect((await detail()).body.data.analysis_status).toBe('pending');
    job.attemptsMade = 2;
    await expect(processAiJob(job)).rejects.toThrow('Model unavailable');
    expect((await detail()).body.data.analysis_status).toBe('failed');
  });
  it('persists a failed analysis while successful indexing remains completed, then recovers on retry', async () => {
    vi.mocked(AiServiceClient.analyzeTranscript).mockRejectedValueOnce(new Error('The AI model is still downloading.'));
    await expect(processRecordingAnalysis(recordingId)).rejects.toThrow('still downloading');
    let response = await detail();
    expect(response.body.data).toMatchObject({ analysis_status: 'failed', analysis_error: 'The AI model is still downloading.', index_status: 'completed', summaries: [] });
    await processRecordingAnalysis(recordingId);
    response = await detail();
    expect(response.body.data.analysis_status).toBe('completed');
    expect(response.body.data.summaries[0].decisions[0]).toMatchObject({ decision: 'Release on Friday', source_timestamp: 0 });
    expect(response.body.data.action_items[0]).toMatchObject({ task: 'Send release checklist', due_date: 'Thursday', source_timestamp: 0 });
    expect(AiServiceClient.generateEmbeddings).toHaveBeenCalledTimes(1);
    expect(AiServiceClient.analyzeTranscript).toHaveBeenCalledWith(expect.stringContaining('[0.00s] Alex:'), 'Release meeting');
  });

  it('retries failed indexing without deleting an action that the user completed', async () => {
    vi.mocked(AiServiceClient.generateEmbeddings).mockRejectedValueOnce(new Error('Embedding model unavailable'));
    await expect(processRecordingAnalysis(recordingId)).rejects.toThrow('Embedding model unavailable');
    const action = await ActionItem.findOne({ recordingId });
    const toggle = await request(app).patch(`/api/v1/recordings/${recordingId}/action-items/${action!._id}`)
      .set('Authorization', `Bearer ${token}`).send({ completed: true });
    expect(toggle.body.data.completed).toBe(true);
    await processRecordingAnalysis(recordingId);
    expect(AiServiceClient.analyzeTranscript).toHaveBeenCalledTimes(1);
    expect((await ActionItem.findById(action!._id))?.status).toBe('completed');
    expect((await detail()).body.data).toMatchObject({ analysis_status: 'completed', index_status: 'completed' });
  });

  it('removes stale action items when a new analysis legitimately returns no tasks', async () => {
    await ActionItem.create({ recordingId, workspaceId, task: 'Old generated task' });
    vi.mocked(AiServiceClient.analyzeTranscript).mockResolvedValueOnce({ ...analysis, action_items: [], decisions: [] });
    await processRecordingAnalysis(recordingId);
    expect(await ActionItem.countDocuments({ recordingId })).toBe(0);
    expect((await Summary.findOne({ recordingId }))?.decisions).toHaveLength(0);
    expect((await detail()).body.data.analysis_status).toBe('completed');
  });

  it('keeps manual completion and task IDs when regenerating unchanged actions', async () => {
    await processRecordingAnalysis(recordingId);
    const action = await ActionItem.findOneAndUpdate({ recordingId }, { $set: { status: 'completed' } }, { new: true });
    await Recording.updateOne({ _id: recordingId }, { $set: { analysisStatus: 'pending' } });
    await processRecordingAnalysis(recordingId);
    expect(await ActionItem.countDocuments({ recordingId })).toBe(1);
    expect((await ActionItem.findById(action!._id))?.status).toBe('completed');
  });

  it('makes queued/processing states visible and does not enqueue duplicate regeneration requests', async () => {
    await Recording.updateOne({ _id: recordingId }, { $set: { analysisStatus: 'failed' } });
    const add = vi.spyOn(aiQueue, 'add').mockResolvedValue({ id: 'queued-test' } as never);
    const regenerate = () => request(app).post(`/api/v1/recordings/${recordingId}/analysis/regenerate`).set('Authorization', `Bearer ${token}`).send({});
    expect((await regenerate()).body.data.status).toBe('pending');
    expect((await regenerate()).status).toBe(200);
    expect(add).toHaveBeenCalledTimes(1);
    expect((await detail()).body.data.analysis_status).toBe('pending');
    let resolveAnalysis!: (value: AnalyzeResponse) => void;
    let started!: () => void;
    const running = new Promise<void>((resolve) => { started = resolve; });
    vi.mocked(AiServiceClient.analyzeTranscript).mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => { resolveAnalysis = resolve; });
    });
    const work = processRecordingAnalysis(recordingId);
    await running;
    expect((await detail()).body.data.analysis_status).toBe('processing');
    resolveAnalysis(analysis);
    await work;
    expect((await detail()).body.data.analysis_status).toBe('completed');
  });

  it('exposes missing analysis on older processed recordings as a recoverable failure', async () => {
    await Recording.updateOne({ _id: recordingId }, { $set: { analysisStatus: null, indexStatus: 'completed' } });
    expect((await detail()).body.data).toMatchObject({ analysis_status: 'failed', summaries: [] });
  });

  it('preserves QA support, model and evidence timestamps instead of claiming every answer is supported', async () => {
    vi.spyOn(AiServiceClient, 'askQuestion').mockResolvedValue({ answer: 'No budget was agreed.', supported_by_transcript: false, timestamps: [0], model_name: 'evidence-model', prompt_tokens: 1, completion_tokens: 2 });
    const response = await request(app).post(`/api/v1/recordings/${recordingId}/ask`).set('Authorization', `Bearer ${token}`).send({ question: 'What budget was agreed?' });
    expect(response.body.data).toMatchObject({ supported_by_transcript: false, timestamps: [0], model_name: 'evidence-model' });
    const second = await request(app).post(`/api/v1/recordings/${recordingId}/ask`).set('Authorization', `Bearer ${token}`).send({ question: 'Who will send the checklist?' });
    expect(second.status).toBe(200);
    // Other members and workspaces cannot contribute answers to this user's history response.
    await RecordingQuestion.create({ recordingId, workspaceId, userId: 'another-member', question: 'Private question', answer: 'Private answer', modelName: 'test' });
    await RecordingQuestion.create({ recordingId, workspaceId: 'another-workspace', userId, question: 'Another workspace', answer: 'Private answer', modelName: 'test' });
    const history = await request(app).get(`/api/v1/recordings/${recordingId}/questions`).set('Authorization', `Bearer ${token}`);
    expect(history.body.data).toHaveLength(2);
    expect(history.body.data.map((item: { question: string }) => item.question)).toEqual(['What budget was agreed?', 'Who will send the checklist?']);
    expect(history.body.data[0]).toMatchObject({ id: response.body.data.id, supported_by_transcript: false, timestamps: [0] });
  });

  it('rejects history access to another workspace and removes saved conversations when their recording is deleted', async () => {
    const foreign = await Recording.create({ workspaceId: 'foreign', userId, title: 'Other workspace', filename: 'other.wav', storagePath: `/tmp/${randomUUID()}.wav` });
    const inaccessible = await request(app).get(`/api/v1/recordings/${foreign._id}/questions`).set('Authorization', `Bearer ${token}`);
    expect(inaccessible.status).toBe(404);
    await RecordingQuestion.create({ recordingId, workspaceId, userId, question: 'Saved question', answer: 'Saved answer', modelName: 'test' });
    const deleted = await request(app).delete(`/api/v1/recordings/${recordingId}`).set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(200);
    expect(await RecordingQuestion.countDocuments({ recordingId, workspaceId })).toBe(0);
  });
});
