import { z } from 'zod';

const envSchema = z.object({
  VITE_ENABLE_ANALYTICS: z.string().optional().transform(val => val === 'true'),
  VITE_SENTRY_DSN: z.string().optional(),
});

export const env = envSchema.parse(import.meta.env);
