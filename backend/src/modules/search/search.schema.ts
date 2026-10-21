import { z } from 'zod';

export const searchSchema = z.object({
  q: z.string().optional(),
  query: z.string().optional(),
  recording_id: z.string().optional(),
  recordingId: z.string().optional(),
  collection_id: z.string().optional(),
  collectionId: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(10),
  min_score: z.coerce.number().min(0).max(1).default(0.2),
});

export const ragAskSchema = z.object({
  query: z.string().optional(),
  question: z.string().optional(),
  recording_ids: z.array(z.string()).optional(),
  recordingIds: z.array(z.string()).optional(),
  collection_id: z.string().optional(),
  collectionId: z.string().optional(),
  top_k: z.number().min(1).max(20).default(5),
});
