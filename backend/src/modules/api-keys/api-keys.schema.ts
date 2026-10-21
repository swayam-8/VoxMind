import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  expires_in_days: z.number().min(1).max(365).optional(),
  expiresInDays: z.number().min(1).max(365).optional(),
});
