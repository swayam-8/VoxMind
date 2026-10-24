import { z } from 'zod';
const identifier = z.string().trim().min(1).max(100);
const collection = identifier.nullable().optional();
export const listRecordingsSchema = z.object({
  status: z.enum(['all', 'queued', 'processing', 'transcribing', 'completed', 'ready', 'failed']).optional(),
  collection_id: identifier.optional(), collectionId: identifier.optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).optional(),
  per_page: z.coerce.number().int().min(1).max(100).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export const uploadRecordingSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  collection_id: collection, collectionId: collection,
  language: z.string().regex(/^[a-z]{2,3}$/i).nullable().optional(),
});
export const updateRecordingSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  collection_id: collection, collectionId: collection,
});
export const askRecordingSchema = z.object({ question: z.string().trim().min(1, 'Question cannot be empty').max(4000) });
export const toggleActionSchema = z.object({ completed: z.boolean().optional() });
