import { env } from '../config/env.js';
import { TheErrorsEmailProvider } from './theerrors-email.provider.js';

class EmailFactory {
  constructor() {
    this.providerInstance = null;
  }

  getProvider() {
    if (!this.providerInstance) {
      const providerType = (env.EMAIL_PROVIDER || 'theerrors').toLowerCase();
      if (providerType === 'theerrors') {
        this.providerInstance = new TheErrorsEmailProvider();
      } else {
        this.providerInstance = new TheErrorsEmailProvider();
      }
    }
    return this.providerInstance;
  }
}

export const emailFactory = new EmailFactory();
export const emailProvider = emailFactory.getProvider();
