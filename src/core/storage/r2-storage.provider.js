import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { BaseStorageProvider } from './storage-provider.interface.js';

export class R2StorageProvider extends BaseStorageProvider {
  constructor() {
    super('r2');
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: env.R2_ACCOUNT_ID
        ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : undefined,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: env.R2_SECRET_ACCESS_KEY || ''
      }
    });
    this.publicBucket = env.R2_PUBLIC_BUCKET || env.R2_PUBLIC_BUCKET_NAME || 'ktc-public';
    this.privateBucket = env.R2_PRIVATE_BUCKET || env.R2_PRIVATE_BUCKET_NAME || 'ktc-private';
    this.publicBaseUrl = (env.R2_PUBLIC_BASE_URL || env.R2_PUBLIC_DOMAIN || '').replace(/\/$/, '');
  }

  async generateUploadTarget({ key, contentType, bucketType = 'PUBLIC', expiresInSeconds = 3600 }) {
    const bucket = bucketType === 'PRIVATE' ? this.privateBucket : this.publicBucket;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });

    return {
      provider: 'r2',
      uploadUrl,
      method: 'PUT',
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
      return this.publicBaseUrl ? `${this.publicBaseUrl}/${key}` : `/${key}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.privateBucket,
      Key: key
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  async deleteAsset({ key, bucketType = 'PUBLIC' }) {
    const bucket = bucketType === 'PRIVATE' ? this.privateBucket : this.publicBucket;
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    });

    await this.s3Client.send(command);
    return { success: true, key, bucketType };
  }
}
