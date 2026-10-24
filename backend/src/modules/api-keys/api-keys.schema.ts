import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  access_level: z.enum(['read', 'write']).default('read'),
  expires_days: z.number().int().min(1).max(365).optional(),
  expires_in_days: z.number().int().min(1).max(365).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
