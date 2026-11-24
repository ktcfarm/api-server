import crypto from 'node:crypto';
import path from 'node:path';
import { ForbiddenError } from '../../core/errors/app.error.js';
import { storageProvider } from '../../core/storage/storage.factory.js';

export class StorageController {
  async presignUpload(req, res, next) {
    try {
      const { purpose, contentType, fileName, expiresInSeconds = 3600 } = req.body;
      const userId = req.user.id;

      const isPrivate = purpose === 'KYC_DOCUMENT' || purpose === 'DISPUTE_EVIDENCE';
      const bucketType = isPrivate ? 'PRIVATE' : 'PUBLIC';

      const ext = path.extname(fileName) || '';
      const baseName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const randomSuffix = crypto.randomBytes(6).toString('hex');
      const key = `${purpose.toLowerCase()}/${userId}/${Date.now()}_${randomSuffix}${ext ? ext : ''}`;

      const uploadTarget = await storageProvider.generateUploadTarget({
        key,
        contentType,
        bucketType,
        expiresInSeconds
      });

      return res.status(200).json({
        success: true,
        data: uploadTarget
      });
    } catch (error) {
      return next(error);
    }
  }

  async getAccessUrl(req, res, next) {
    try {
      const { key, expiresInSeconds = 3600 } = req.query;
      let { bucketType } = req.query;

      if (!bucketType) {
        if (key.startsWith('kyc_document/') || key.startsWith('dispute_evidence/')) {
          bucketType = 'PRIVATE';
        } else {
          bucketType = 'PUBLIC';
        }
      }

      if (bucketType === 'PRIVATE') {
        const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
        const isPrivileged =
          userRoles.includes('SUPER_ADMIN') ||
          userRoles.includes('ADMIN') ||
          userRoles.includes('HUB_MANAGER') ||
          userRoles.includes('STORE_OPERATOR');

        const isOwner = key.includes(`/${req.user.id}/`);

        if (!isPrivileged && !isOwner) {
          throw new ForbiddenError('You do not have permission to access this private file');
        }
      }

      const accessUrl = await storageProvider.getAccessUrl({
        key,
        bucketType,
        expiresInSeconds
      });

      return res.status(200).json({
        success: true,
        data: {
          accessUrl,
          key,
          bucketType
        }
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const storageController = new StorageController();
