export class BaseOtpChannel {
  constructor(channelType) {
    if (new.target === BaseOtpChannel) {
      throw new TypeError('Cannot construct BaseOtpChannel instances directly');
    }
    this.channelType = channelType;
  }

  async sendOtp(_payload) {
    throw new Error('Method sendOtp() must be implemented');
  }
}
