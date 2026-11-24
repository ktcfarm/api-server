export class BaseStorageProvider {
  constructor(providerName) {
    if (new.target === BaseStorageProvider) {
      throw new TypeError('Cannot construct BaseStorageProvider instances directly');
    }
    this.providerName = providerName;
  }

  async generateUploadTarget(_params) {
    throw new Error('Method generateUploadTarget() must be implemented');
  }

  async getAccessUrl(_params) {
    throw new Error('Method getAccessUrl() must be implemented');
  }

  async deleteAsset(_params) {
    throw new Error('Method deleteAsset() must be implemented');
  }
}
