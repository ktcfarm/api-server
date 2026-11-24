import { env } from '../config/env.js';
import { CloudinaryStorageProvider } from './cloudinary-storage.provider.js';
import { R2StorageProvider } from './r2-storage.provider.js';

class StorageFactory {
  constructor() {
    this.providerInstance = null;
  }

  getProvider() {
    if (!this.providerInstance) {
      const providerType = (env.STORAGE_PROVIDER || 'r2').toLowerCase();
      if (providerType === 'cloudinary') {
        this.providerInstance = new CloudinaryStorageProvider();
      } else {
        this.providerInstance = new R2StorageProvider();
      }
    }
    return this.providerInstance;
  }
}

export const storageFactory = new StorageFactory();
export const storageProvider = storageFactory.getProvider();
