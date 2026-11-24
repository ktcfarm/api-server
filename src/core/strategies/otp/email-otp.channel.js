import { env } from '../../config/env.js';
import { emailProvider } from '../../email/email.factory.js';
import { BaseOtpChannel } from './otp-channel.interface.js';

const PURPOSE_LABEL_MAP = {
  REGISTER: 'Account Registration',
  LOGIN: 'Login',
  RESET_PIN: 'PIN Reset',
  VERIFY_EMAIL: 'Email Verification',
  VERIFY_PHONE: 'Phone Verification',
  CASH_HANDOVER: 'Cash Handover',
};

export class EmailOtpChannel extends BaseOtpChannel {
  constructor() {
    super('EMAIL');
  }

  async sendOtp(payload) {
    const { identifier, recipient, otp, purpose, expiresInMinutes, expiresAt } = payload;
    const to = identifier || recipient;

    const readablePurpose = PURPOSE_LABEL_MAP[purpose] || purpose;
    const calculatedExpiry =
      expiresInMinutes ??
      (expiresAt ? Math.max(1, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000)) : 10);

    const templateName = env.MAIL_OTP_TEMPLATE || 'ktc_otp';

    try {
      const result = await emailProvider.sendTemplateEmail({
        to,
        templateName,
        data: {
          otp,
          purpose: readablePurpose,
          expiryMinutes: String(calculatedExpiry),
        },
      });

      return {
        success: true,
        messageId: result?.id || result?.messageId || `email-${Date.now()}`,
        channel: this.channelType,
        recipient: to,
        deliveredAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        channel: this.channelType,
        recipient: to,
        deliveredAt: new Date(),
        error: error.message,
      };
    }
  }
}
