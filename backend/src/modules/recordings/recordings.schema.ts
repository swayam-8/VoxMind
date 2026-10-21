import { z } from 'zod';

export const listRecordingsSchema = z.object({
  status: z.enum(['queued', 'processing', 'completed', 'failed']).optional(),
  collection_id: z.string().optional(),
  collectionId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  page_size: z.coerce.number().min(1).max(100).default(20),
  pageSize: z.coerce.number().min(1).max(100).optional(),
});

export const updateRecordingSchema = z.object({
  title: z.string().min(1).optional(),
  collection_id: z.string().nullable().optional(),
  collectionId: z.string().nullable().optional(),
});

export const askRecordingSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
});
