export class BaseEmailProvider {
  constructor(providerName) {
    if (new.target === BaseEmailProvider) {
      throw new TypeError('Cannot construct BaseEmailProvider instances directly');
    }
    this.providerName = providerName;
  }

  async sendTemplateEmail(_params) {
    throw new Error('Method sendTemplateEmail() must be implemented');
  }

  async sendGroupTemplateEmail(_params) {
    throw new Error('Method sendGroupTemplateEmail() must be implemented');
  }
}
