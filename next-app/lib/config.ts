import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  ENCRYPTION_KEY: z.string().length(64).optional(), // 32-byte AES-256 key as 64-char hex
  DIDIT_MOCK: z.string().optional(), // set to any non-empty value to bypass Didit and auto-approve users
  DIDIT_API_KEY: z.string().min(1).optional(),
  DIDIT_API_URL: z.string().url().default('https://verification.didit.me'),
  DIDIT_WORKFLOW_ID: z.string().min(1).optional(),
  DIDIT_KYC_WORKFLOW_ID: z.string().min(1).optional(),
  DIDIT_BIOMETRIC_WORKFLOW_ID: z.string().min(1).optional(),
  DIDIT_WEBHOOK_SECRET: z.string().min(1).optional(),
  SITE_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
