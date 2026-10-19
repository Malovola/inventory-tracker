import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HTTPS_PORT: z.coerce.number().default(3443),
  ENABLE_HTTPS: z
    .string()
    .optional()
    .transform((val) => val === undefined || val === 'true' || val === '1'),
  DATABASE_URL: z.string().default('postgres://postgres:25022547267792@localhost:5432/inventory_tracker_dev'),
  JWT_SECRET: z.string().default('nextrack-super-secret-jwt-token-key-2026'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
  API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
