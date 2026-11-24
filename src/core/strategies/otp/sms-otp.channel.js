import { BaseOtpChannel } from './otp-channel.interface.js';

export class SmsOtpChannel extends BaseOtpChannel {
  constructor() {
    super('SMS');
  }

  async sendOtp(payload) {
    return {
      success: true,
      messageId: `sms-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      channel: this.channelType,
      recipient: payload.recipient,
      deliveredAt: new Date(),
    };
  }
}
