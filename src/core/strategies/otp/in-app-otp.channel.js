import { BaseOtpChannel } from './otp-channel.interface.js';

export class InAppNotificationOtpChannel extends BaseOtpChannel {
  constructor() {
    super('IN_APP');
  }

  async sendOtp(payload) {
    return {
      success: true,
      messageId: `inapp-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      channel: this.channelType,
      recipient: payload.recipient,
      deliveredAt: new Date(),
    };
  }
}
