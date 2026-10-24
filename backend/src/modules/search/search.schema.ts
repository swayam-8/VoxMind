import { z } from 'zod';
const id = z.string().min(1).max(100);
const ids = z.array(id).max(100);
const text = z.string().trim().max(4000);
export const searchSchema = z.object({
  q: text.optional(), query: text.optional(),
  recording_id: id.optional(), recordingId: id.optional(),
  recording_ids: ids.optional(), recordingIds: ids.optional(),
  collection_id: id.optional(), collectionId: id.optional(),
  mode: z.enum(['hybrid', 'semantic', 'keyword']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  min_score: z.coerce.number().min(0).max(1).default(0.2),
});
export const ragAskSchema = z.object({
  query: text.optional(), question: text.optional(),
  recording_ids: ids.optional(), recordingIds: ids.optional(),
  collection_id: id.optional(), collectionId: id.optional(),
  top_k: z.number().int().min(1).max(20).optional(),
  max_passages: z.number().int().min(1).max(20).optional(),
}).refine((value) => Boolean(value.query || value.question), { message: 'Question is required' });
