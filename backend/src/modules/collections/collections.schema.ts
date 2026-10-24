import { z } from 'zod';

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1, 'Collection name is required').max(150),
  description: z.string().max(2000).optional().default(''),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional().default('#6366f1'),
});

export const updateCollectionSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(2000).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export const addRecordingToCollectionSchema = z.object({
  recording_id: z.string().optional(),
  recordingId: z.string().max(100).optional(),
  recording_ids: z.array(z.string().min(1).max(100)).max(100).optional(),
  recordingIds: z.array(z.string().min(1).max(100)).max(100).optional(),
});
