import { z } from 'zod';

const password = z.string().min(8, 'Password must be at least 8 characters long')
  .max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes');

export const registerSchema = z.object({
  email: z.string().trim().max(254).email(),
  password,
  fullName: z.string().trim().max(120).optional().default(''),
});

export const loginSchema = z.object({
  email: z.string().trim().max(254).email(),
  password: z.string().min(1, 'Password is required').max(256),
});

export const updateMeSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  currentPassword: z.string().max(256).optional(),
  newPassword: password.optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
