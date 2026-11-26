import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../core/config/env.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../../core/errors/app.error.js';
import { EmailOtpChannel } from '../../core/strategies/otp/email-otp.channel.js';
import { InAppNotificationOtpChannel } from '../../core/strategies/otp/in-app-otp.channel.js';
import { SmsOtpChannel } from '../../core/strategies/otp/sms-otp.channel.js';
import { authRepository } from './auth.repository.js';

export class AuthService {
  constructor() {
    this.otpChannels = new Map([
      ['EMAIL', new EmailOtpChannel()],
      ['SMS', new SmsOtpChannel()],
      ['IN_APP', new InAppNotificationOtpChannel()],
    ]);
  }

  generateNumericOtp(length = 6) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return String(crypto.randomInt(min, max + 1));
  }

  hashValue(val) {
    return crypto.createHash('sha256').update(val).digest('hex');
  }

  generateTokens(user, sessionId, activeRole) {
    const accessToken = jwt.sign(
      {
        sub: user.id,
        sessionId,
        activeRole,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      {
        sub: user.id,
        sessionId,
      },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
    );

    return { accessToken, refreshToken };
  }

  sanitizeUser(user) {
    const { pinHash, ...sanitized } = user;
    return sanitized;
  }

  formatStaffAssignments(staffAssignments = []) {
    return staffAssignments.map((s) => ({
      hubId: s.hubId,
      role: s.role,
      isActive: s.isActive,
      hubName: s.hub?.name || null,
      hubCode: s.hub?.code || null,
    }));
  }

  async sendOtp(identifier, channel, purpose, metadata = null) {
    const otpChannel = this.otpChannels.get(channel);
    if (!otpChannel) {
      throw new BadRequestError(`Unsupported OTP channel: ${channel}`);
    }

    const otp = this.generateNumericOtp(6);
    const otpHash = await bcrypt.hash(otp, env.BCRYPT_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await authRepository.invalidateOtps(identifier, purpose);

    await authRepository.createOtp({
      identifier,
      channel,
      purpose,
      otpHash,
      expiresAt,
      metadata,
    });

    const dispatchResult = await otpChannel.sendOtp({
      recipient: identifier,
      otp,
      purpose,
      expiresAt,
      metadata,
    });

    if (!dispatchResult.success) {
      throw new BadRequestError(`Failed to dispatch OTP: ${dispatchResult.error}`);
    }

    return {
      success: true,
      message: 'OTP dispatched successfully',
      expiresAt,
    };
  }

  async verifyOtpCode(identifier, purpose, plainOtp) {
    const record = await authRepository.findLatestUnusedOtp(identifier, purpose);
    if (!record) {
      throw new BadRequestError('Invalid or expired OTP. Please request a new code.');
    }

    if (record.attempts >= record.maxAttempts) {
      await authRepository.markOtpUsed(record.id);
      throw new TooManyRequestsError('Maximum OTP verification attempts exceeded.');
    }

    const matches = await bcrypt.compare(plainOtp, record.otpHash);
    if (!matches) {
      await authRepository.incrementOtpAttempts(record.id);
      throw new BadRequestError('Incorrect OTP code.');
    }

    await authRepository.markOtpUsed(record.id);
    return true;
  }

  async register(params, clientInfo = {}) {
    const { email, otp, name, pin, phone, intendedRole, farmerDetails } = params;

    await this.verifyOtpCode(email, 'REGISTER', otp);

    const pinHash = await bcrypt.hash(pin, env.BCRYPT_SALT_ROUNDS);
    const rawRefresh = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashValue(rawRefresh);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    let registered;
    try {
      registered = await authRepository.registerUserWithProfiles({
        email,
        phone,
        name,
        pinHash,
        intendedRole,
        farmerDetails,
        sessionData: {
          refreshTokenHash,
          deviceInfo: clientInfo.deviceInfo,
          ipAddress: clientInfo.ipAddress,
          expiresAt,
        },
      });
    } catch (err) {
      if (err.message === 'EMAIL_ALREADY_VERIFIED') {
        throw new ConflictError('This email is already registered and verified.');
      }
      if (err.message === 'PHONE_ALREADY_VERIFIED') {
        throw new ConflictError('This phone number is already verified on another account.');
      }
      throw err;
    }

    const { user, session } = registered;
    const tokens = this.generateTokens(user, session.id, intendedRole);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeRole: intendedRole,
      user: this.sanitizeUser(user),
    };
  }

  async loginWithPin(identifier, pin, targetRole, clientInfo = {}) {
    const user = await authRepository.findVerifiedUserByIdentifier(identifier);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.pinLockedUntil && new Date(user.pinLockedUntil) > new Date()) {
      const remainingMinutes = Math.ceil(
        (new Date(user.pinLockedUntil).getTime() - Date.now()) / 60000
      );
      throw new ForbiddenError(
        `Account locked due to consecutive failed PIN attempts. Try again in ${remainingMinutes} minute(s).`
      );
    }

    if (!user.pinHash) {
      throw new UnauthorizedError('No PIN set on account. Please login using OTP or reset your PIN.');
    }

    const matches = await bcrypt.compare(pin, user.pinHash);
    if (!matches) {
      const nextFailures = (user.failedPinAttempts || 0) + 1;
      let lockUntil = null;
      if (nextFailures >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await authRepository.recordFailedPinAttempt(user.id, nextFailures, lockUntil);
      throw new UnauthorizedError('Invalid PIN');
    }

    await authRepository.resetPinAttempts(user.id);

    const userRoles = user.roles.map((r) => r.role);

    if (targetRole === 'FARMER' && !userRoles.includes('FARMER')) {
      if (userRoles.includes('BUYER')) {
        return {
          requiresFarmerOnboarding: true,
          message: 'Farmer registration required before entering Farmer mode.',
          userId: user.id,
        };
      }
    }

    if (!userRoles.includes(targetRole)) {
      throw new ForbiddenError(`User is not authorized for role ${targetRole}`);
    }

    if (targetRole === 'STORE_OPERATOR' || targetRole === 'HUB_MANAGER') {
      const hasActiveAssignment = user.staffAssignments.some(
        (s) => s.role === targetRole && s.isActive
      );
      if (!hasActiveAssignment) {
        throw new ForbiddenError(`User does not have an active ${targetRole} hub assignment.`);
      }
    }

    const rawRefresh = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashValue(rawRefresh);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const session = await authRepository.createSession({
      userId: user.id,
      refreshTokenHash,
      activeRole: targetRole,
      deviceInfo: clientInfo.deviceInfo,
      ipAddress: clientInfo.ipAddress,
      expiresAt,
    });

    const tokens = this.generateTokens(user, session.id, targetRole);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeRole: targetRole,
      roles: userRoles,
      staffAssignments: this.formatStaffAssignments(user.staffAssignments),
      user: this.sanitizeUser(user),
    };
  }

  async loginWithOtp(identifier, otp, targetRole, clientInfo = {}) {
    await this.verifyOtpCode(identifier, 'LOGIN', otp);

    const user = await authRepository.findVerifiedUserByIdentifier(identifier);
    if (!user) {
      throw new NotFoundError('No verified account found for this identifier. Please register first.');
    }

    const userRoles = user.roles.map((r) => r.role);

    if (targetRole === 'FARMER' && !userRoles.includes('FARMER')) {
      if (userRoles.includes('BUYER')) {
        return {
          requiresFarmerOnboarding: true,
          message: 'Farmer registration required before entering Farmer mode.',
          userId: user.id,
        };
      }
    }

    if (!userRoles.includes(targetRole)) {
      throw new ForbiddenError(`User is not authorized for role ${targetRole}`);
    }

    if (targetRole === 'STORE_OPERATOR' || targetRole === 'HUB_MANAGER') {
      const hasActiveAssignment = user.staffAssignments.some(
        (s) => s.role === targetRole && s.isActive
      );
      if (!hasActiveAssignment) {
        throw new ForbiddenError(`User does not have an active ${targetRole} hub assignment.`);
      }
    }

    const rawRefresh = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashValue(rawRefresh);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const session = await authRepository.createSession({
      userId: user.id,
      refreshTokenHash,
      activeRole: targetRole,
      deviceInfo: clientInfo.deviceInfo,
      ipAddress: clientInfo.ipAddress,
      expiresAt,
    });

    const tokens = this.generateTokens(user, session.id, targetRole);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeRole: targetRole,
      roles: userRoles,
      staffAssignments: this.formatStaffAssignments(user.staffAssignments),
      user: this.sanitizeUser(user),
    };
  }

  async onboardFarmer(userId, farmerData, sessionId) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const { user: updatedUser, farmerProfile } = await authRepository.onboardFarmer(
      userId,
      farmerData,
      sessionId
    );

    const tokens = this.generateTokens(updatedUser, sessionId, 'FARMER');

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeRole: 'FARMER',
      user: this.sanitizeUser(updatedUser),
      farmerProfile,
    };
  }

  async resetPin(identifier, otp, newPin) {
    await this.verifyOtpCode(identifier, 'RESET_PIN', otp);

    const user = await authRepository.findVerifiedUserByIdentifier(identifier);
    if (!user) {
      throw new NotFoundError('Account not found');
    }

    const pinHash = await bcrypt.hash(newPin, env.BCRYPT_SALT_ROUNDS);
    await authRepository.updateUserPinAndClearSessions(user.id, pinHash);

    return {
      success: true,
      message: 'PIN has been reset successfully. Please log in with your new PIN.',
    };
  }

  async refreshToken(refreshTokenStr) {
    let decoded;
    try {
      decoded = jwt.verify(refreshTokenStr, env.JWT_REFRESH_SECRET);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const session = await authRepository.findSessionById(decoded.sessionId);
    if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
      throw new UnauthorizedError('Session has expired or was revoked. Please log in again.');
    }

    const user = await authRepository.findUserById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is inactive or not found');
    }

    const newRawRefresh = crypto.randomBytes(32).toString('hex');
    const newRefreshTokenHash = this.hashValue(newRawRefresh);
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await authRepository.rotateSessionRefreshToken(session.id, newRefreshTokenHash, newExpiresAt);

    const tokens = this.generateTokens(user, session.id, session.activeRole);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeRole: session.activeRole,
    };
  }

  async logout(sessionId) {
    if (sessionId) {
      await authRepository.revokeSession(sessionId);
    }
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async verifyIdentifier(userId, identifier, channel, otp) {
    const purpose = channel === 'EMAIL' ? 'VERIFY_EMAIL' : 'VERIFY_PHONE';
    await this.verifyOtpCode(identifier, purpose, otp);

    try {
      const updatedUser = await authRepository.verifySecondaryIdentifier(
        userId,
        identifier,
        channel
      );
      return {
        success: true,
        message: `${channel === 'EMAIL' ? 'Email' : 'Phone'} verified successfully.`,
        user: this.sanitizeUser(updatedUser),
      };
    } catch (err) {
      if (err.message === 'EMAIL_ALREADY_VERIFIED') {
        throw new ConflictError('This email is already verified by another account.');
      }
      if (err.message === 'PHONE_ALREADY_VERIFIED') {
        throw new ConflictError('This phone number is already verified by another account.');
      }
      throw err;
    }
  }

  async getMe(userId, activeRole, sessionId) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      user: this.sanitizeUser(user),
      activeRole,
      sessionId,
      roles: user.roles.map((r) => r.role),
      staffAssignments: this.formatStaffAssignments(user.staffAssignments),
      buyerProfile: user.buyerProfile,
      farmerProfile: user.farmerProfile,
    };
  }

  async switchRole(userId, sessionId, targetRole) {
    const user = await authRepository.findUserById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is inactive or not found');
    }

    const userRoles = user.roles.map((r) => r.role);
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');

    if (!isSuperAdmin && !userRoles.includes(targetRole)) {
      throw new ForbiddenError(`User is not authorized for role ${targetRole}`);
    }

    if (
      !isSuperAdmin &&
      (targetRole === 'STORE_OPERATOR' || targetRole === 'HUB_MANAGER')
    ) {
      const hasActiveAssignment = user.staffAssignments.some(
        (s) => s.role === targetRole && s.isActive
      );
      if (!hasActiveAssignment) {
        throw new ForbiddenError(
          `User does not have an active ${targetRole} hub assignment.`
        );
      }
    }

    const session = await authRepository.findSessionById(sessionId);
    if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
      throw new UnauthorizedError('Session has expired or was revoked.');
    }

    await authRepository.updateSessionActiveRole(session.id, targetRole);

    const newRawRefresh = crypto.randomBytes(32).toString('hex');
    const newRefreshTokenHash = this.hashValue(newRawRefresh);
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await authRepository.rotateSessionRefreshToken(
      session.id,
      newRefreshTokenHash,
      newExpiresAt
    );

    const tokens = this.generateTokens(user, session.id, targetRole);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeRole: targetRole,
      roles: userRoles,
      staffAssignments: this.formatStaffAssignments(user.staffAssignments),
      user: this.sanitizeUser(user),
    };
  }
}

export const authService = new AuthService();
