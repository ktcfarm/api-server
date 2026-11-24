import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const envSchema = z
  .object({
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
    R2_ENDPOINT: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_PUBLIC_BUCKET: z.string().default(process.env.R2_PUBLIC_BUCKET_NAME || 'ktc-public'),
    R2_PRIVATE_BUCKET: z.string().default(process.env.R2_PRIVATE_BUCKET_NAME || 'ktc-private'),
    R2_PUBLIC_BASE_URL: z.string().default(process.env.R2_PUBLIC_DOMAIN || 'https://pub-cdn.ktc.in'),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CORS_ADMIN_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((data, ctx) => {
    if (data.STORAGE_PROVIDER === 'r2') {
      if (!data.R2_ACCOUNT_ID && !data.R2_ENDPOINT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'R2_ACCOUNT_ID or R2_ENDPOINT is required when STORAGE_PROVIDER is r2',
          path: ['R2_ACCOUNT_ID'],
        });
      }
      if (!data.R2_ACCESS_KEY_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'R2_ACCESS_KEY_ID is required when STORAGE_PROVIDER is r2',
          path: ['R2_ACCESS_KEY_ID'],
        });
      }
      if (!data.R2_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'R2_SECRET_ACCESS_KEY is required when STORAGE_PROVIDER is r2',
          path: ['R2_SECRET_ACCESS_KEY'],
        });
      }
    }

    if (data.STORAGE_PROVIDER === 'cloudinary') {
      if (!data.CLOUDINARY_CLOUD_NAME) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CLOUDINARY_CLOUD_NAME is required when STORAGE_PROVIDER is cloudinary',
          path: ['CLOUDINARY_CLOUD_NAME'],
        });
      }
      if (!data.CLOUDINARY_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CLOUDINARY_API_KEY is required when STORAGE_PROVIDER is cloudinary',
          path: ['CLOUDINARY_API_KEY'],
        });
      }
      if (!data.CLOUDINARY_API_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CLOUDINARY_API_SECRET is required when STORAGE_PROVIDER is cloudinary',
          path: ['CLOUDINARY_API_SECRET'],
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment variable validation failed');
}

export const env = parsed.data;
