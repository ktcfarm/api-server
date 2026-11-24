import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { BaseStorageProvider } from './storage-provider.interface.js';

export class CloudinaryStorageProvider extends BaseStorageProvider {
  constructor() {
    super('cloudinary');
    if (env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true
      });
    }
    this.cloudName = env.CLOUDINARY_CLOUD_NAME || '';
    this.apiKey = env.CLOUDINARY_API_KEY || '';
    this.apiSecret = env.CLOUDINARY_API_SECRET || '';
  }

  async generateUploadTarget({ key, contentType, bucketType = 'PUBLIC', expiresInSeconds = 3600 }) {
    const timestamp = Math.floor(Date.now() / 1000);
    const type = bucketType === 'PRIVATE' ? 'authenticated' : 'upload';
    const paramsToSign = {
      public_id: key,
      timestamp,
      type
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, this.apiSecret);
    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;

    return {
      provider: 'cloudinary',
      uploadUrl,
      method: 'POST',
      fields: {
        api_key: this.apiKey,
        timestamp,
        signature,
        public_id: key,
        type
      },
      headers: {
        'Content-Type': contentType
      },
      key,
      bucketType,
      expiresInSeconds
    };
  }

  async getAccessUrl({ key, bucketType = 'PUBLIC', expiresInSeconds = 3600 }) {
    if (bucketType === 'PUBLIC') {
      return cloudinary.url(key, { secure: true, type: 'upload' });
    }

    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return cloudinary.url(key, {
      secure: true,
      sign_url: true,
      type: 'authenticated',
      expires_at: expiresAt
    });
  }

  async deleteAsset({ key, bucketType = 'PUBLIC' }) {
    const type = bucketType === 'PRIVATE' ? 'authenticated' : 'upload';
    await cloudinary.uploader.destroy(key, { type, invalidate: true });
    return { success: true, key, bucketType };
  }
}
