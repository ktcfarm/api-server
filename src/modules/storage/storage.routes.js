import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { storageController } from './storage.controller.js';
import { accessUrlSchema, presignUploadSchema } from './storage.validation.js';

export const storageRouter = Router();

storageRouter.post(
  '/presign-upload',
  authMiddleware,
  validate(presignUploadSchema, 'body'),
  storageController.presignUpload
);

storageRouter.get(
  '/access-url',
  authMiddleware,
  validate(accessUrlSchema, 'query'),
  storageController.getAccessUrl
);
