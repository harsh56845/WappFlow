import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from workspace root or current directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/whatsflow'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().default('whatsflow_jwt_secret_key_default_2026'),
  JWT_REFRESH_SECRET: z.string().default('whatsflow_jwt_refresh_secret_key_default_2026'),
  ENCRYPTION_KEY: z.string().default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  DEMO_MODE: z.string().transform(val => val === 'true').default('true'),
  WHATSAPP_API_VERSION: z.string().default('v20.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional().default(''),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().default('whatsflow_verify_token_secure'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DEFAULT_COUNTRY: z.string().default('IN')
});

export const env = envSchema.parse(process.env);
