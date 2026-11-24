import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  EMAIL_PROVIDER: z.string().default('theerrors'),
  MAIL_API_URL: z.string().url().default('https://services.theerrors.in'),
  MAIL_API_KEY: z.string().min(1, 'MAIL_API_KEY is required'),
  MAIL_OTP_TEMPLATE: z.string().default('ktc_otp'),
  MAIL_FROM_EMAIL: z.string().email().default('noreply@ktc.in'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),
  STORAGE_PROVIDER: z.enum(['r2', 'cloudinary']).default('r2'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_PUBLIC_BUCKET: z.string().default(process.env.R2_PUBLIC_BUCKET_NAME || 'ktc-public-media'),
  R2_PRIVATE_BUCKET: z.string().default(process.env.R2_PRIVATE_BUCKET_NAME || 'ktc-private-documents'),
  R2_PUBLIC_BASE_URL: z.string().default(process.env.R2_PUBLIC_DOMAIN || 'https://media.ktc.in'),
  R2_PUBLIC_BUCKET_NAME: z.string().optional(),
  R2_PRIVATE_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_DOMAIN: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CORS_ADMIN_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment variable validation failed');
}

export const env = parsed.data;
