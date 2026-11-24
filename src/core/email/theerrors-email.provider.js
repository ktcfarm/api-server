import { env } from '../config/env.js';
import { AppError } from '../errors/app.error.js';
import { logger } from '../logging/logger.js';
import { BaseEmailProvider } from './email-provider.interface.js';

export class TheErrorsEmailProvider extends BaseEmailProvider {
  constructor() {
    super('theerrors');
    this.baseUrl = (env.MAIL_API_URL || 'https://services.theerrors.in').replace(/\/$/, '');
  }

  async sendTemplateEmail({ to, templateName, data }) {
    const endpoint = `${this.baseUrl}/api/services/email/send`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.MAIL_API_KEY,
        },
        body: JSON.stringify({
          templateName,
          to,
          data,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error(
          {
            provider: this.providerName,
            status: response.status,
            statusText: response.statusText,
            to,
            templateName,
            error: errorText,
          },
          'Email delivery failed via TheErrors provider'
        );

        const statusCode = response.status >= 500 ? 502 : response.status;
        throw new AppError(
          statusCode,
          `Email delivery failed (${response.status}): ${errorText || response.statusText}`
        );
      }

      return await response.json().catch(() => ({ success: true }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error(
        {
          provider: this.providerName,
          to,
          templateName,
          error: error.message,
        },
        'Network or dispatch error while calling email service'
      );
      throw new AppError(502, `Email service communication error: ${error.message}`);
    }
  }

  async sendGroupTemplateEmail({ groupName, templateName, data }) {
    const endpoint = `${this.baseUrl}/api/services/email/send-group`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.MAIL_API_KEY,
        },
        body: JSON.stringify({
          templateName,
          groupName,
          data,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error(
          {
            provider: this.providerName,
            status: response.status,
            statusText: response.statusText,
            groupName,
            templateName,
            error: errorText,
          },
          'Group email delivery failed via TheErrors provider'
        );

        const statusCode = response.status >= 500 ? 502 : response.status;
        throw new AppError(
          statusCode,
          `Group email delivery failed (${response.status}): ${errorText || response.statusText}`
        );
      }

      return await response.json().catch(() => ({ success: true }));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error(
        {
          provider: this.providerName,
          groupName,
          templateName,
          error: error.message,
        },
        'Network or dispatch error while calling group email service'
      );
      throw new AppError(502, `Group email service communication error: ${error.message}`);
    }
  }
}
