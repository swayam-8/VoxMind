import { z } from 'zod';

export const createCollectionSchema = z.object({
  name: z.string().min(1, 'Collection name is required'),
  description: z.string().optional().default(''),
  color: z.string().optional().default('#6366f1'),
});

export const updateCollectionSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
});

export const addRecordingToCollectionSchema = z.object({
  recording_id: z.string().optional(),
  recordingId: z.string().optional(),
});
