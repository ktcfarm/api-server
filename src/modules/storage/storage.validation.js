import { z } from 'zod';

export const presignUploadSchema = z.object({
  purpose: z.enum(['CROP_PHOTO', 'KYC_DOCUMENT', 'DISPUTE_EVIDENCE', 'PROFILE_PHOTO']),
  contentType: z.string().min(1, 'Content-Type is required'),
  fileName: z.string().min(1, 'File name is required'),
  expiresInSeconds: z.coerce.number().int().positive().optional().default(3600)
});

export const accessUrlSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  bucketType: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  expiresInSeconds: z.coerce.number().int().positive().optional().default(3600)
});
