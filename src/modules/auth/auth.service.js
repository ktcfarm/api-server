import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
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
import { invalidateAuthCache } from '../../core/middleware/auth.middleware.js';
import { EmailOtpChannel } from '../../core/strategies/otp/email-otp.channel.js';
import { InAppNotificationOtpChannel } from '../../core/strategies/otp/in-app-otp.channel.js';
import { SmsOtpChannel } from '../../core/strategies/otp/sms-otp.channel.js';
import { authRepository } from './auth.repository.js';
import {
  computeFarmerOnboardingState,
  formatAadhaarDocument,
  formatBankAccount,
  formatDeliveryAddress,
  formatUserPreferences,
  hashSha256,
  mapLandSizeToAcres,
  maskAadhaar,
  normalizeEmail,
  normalizeIdentifier,
} from './auth.utils.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthService {
  constructor() {
    this.otpChannels = new Map([
      ['EMAIL', new EmailOtpChannel()],
      ['SMS', new SmsOtpChannel()],
      ['IN_APP', new InAppNotificationOtpChannel()],
    ]);
    this.issueTokensBound = this.generateTokens.bind(this);
  }

  generateNumericOtp(length = 6) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return String(crypto.randomInt(min, max + 1));
  }

  hashValue(val) {
    return hashSha256(val);
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
    if (!user) return null;
    const { pinHash, bankAccounts, documents, addresses, ...rest } = user;
    const aadhaarDoc = Array.isArray(documents)
      ? documents.find((d) => d.docType === 'AADHAAR') || null
      : null;
    const allAddresses = Array.isArray(addresses) ? addresses : [];
    const farmAddress = allAddresses.find((a) => a.label === 'FARM') || null;
    const deliveryAddresses = allAddresses
      .filter((a) => a.label !== 'FARM')
      .map(formatDeliveryAddress);

    return {
      ...rest,
      preferences: formatUserPreferences(user.preferences),
      aadhaarDocument: formatAadhaarDocument(aadhaarDoc),
      farmAddress,
      deliveryAddresses,
      bankAccounts: Array.isArray(bankAccounts) ? bankAccounts.map(formatBankAccount) : [],
    };
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

  async _finalizeRoleLogin(user, targetRole, clientInfo = {}) {
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

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const { tokens } = await authRepository.createSessionWithTokens(
      {
        userId: user.id,
        activeRole: targetRole,
        deviceInfo: clientInfo.deviceInfo,
        ipAddress: clientInfo.ipAddress,
        expiresAt,
      },
      this.issueTokensBound,
      user
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeRole: targetRole,
      roles: userRoles,
      staffAssignments: this.formatStaffAssignments(user.staffAssignments),
      user: this.sanitizeUser(user),
      farmerOnboarding: computeFarmerOnboardingState(user),
    };
  }

  async sendOtp(identifier, channel, purpose, metadata = null) {
    const otpChannel = this.otpChannels.get(channel);
    if (!otpChannel) {
      throw new BadRequestError(`Unsupported OTP channel: ${channel}`);
    }

    const normalizedIdentifier = normalizeIdentifier(identifier, channel);

    if (purpose === 'REGISTER' && (channel === 'EMAIL' || channel === 'SMS')) {
      const existing = await authRepository.findVerifiedUserByChannel(
        normalizedIdentifier,
        channel
      );
      if (existing) {
        throw new ConflictError(
          channel === 'EMAIL'
            ? 'This email is already registered and verified.'
            : 'This phone number is already registered and verified.'
        );
      }
    }

    const otp = this.generateNumericOtp(6);
    const otpHash = await bcrypt.hash(otp, env.BCRYPT_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await authRepository.invalidateOtps(normalizedIdentifier, purpose);

    await authRepository.createOtp({
      identifier: normalizedIdentifier,
      channel,
      purpose,
      otpHash,
      expiresAt,
      metadata,
    });

    const dispatchResult = await otpChannel.sendOtp({
      recipient: normalizedIdentifier,
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
    const {
      otp,
      name,
      pin,
      phone,
      languagePref,
      intendedRole,
      farmerDetails,
    } = params;
    const email = normalizeEmail(params.email);

    await this.verifyOtpCode(email, 'REGISTER', otp);

    const pinHash = await bcrypt.hash(pin, env.BCRYPT_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    let registered;
    try {
      registered = await authRepository.registerUserWithProfiles(
        {
          email,
          phone,
          name,
          pinHash,
          languagePref,
          termsAcceptedAt: new Date(),
          intendedRole,
          farmerDetails,
          sessionData: {
            deviceInfo: clientInfo.deviceInfo,
            ipAddress: clientInfo.ipAddress,
            expiresAt,
          },
        },
        this.issueTokensBound
      );
    } catch (err) {
      if (err.message === 'EMAIL_ALREADY_VERIFIED') {
        throw new ConflictError('This email is already registered and verified.');
      }
      if (err.message === 'PHONE_ALREADY_VERIFIED') {
        throw new ConflictError('This phone number is already verified on another account.');
      }
      throw err;
    }

    const { user, tokens } = registered;

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeRole: intendedRole,
      roles: user.roles.map((r) => r.role),
      staffAssignments: this.formatStaffAssignments(user.staffAssignments),
      user: this.sanitizeUser(user),
      farmerOnboarding: computeFarmerOnboardingState(user),
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
    return this._finalizeRoleLogin(user, targetRole, clientInfo);
  }

  async loginWithOtp(identifier, otp, targetRole, clientInfo = {}) {
    await this.verifyOtpCode(identifier, 'LOGIN', otp);

    const user = await authRepository.findVerifiedUserByIdentifier(identifier);
    if (!user) {
      throw new NotFoundError('No verified account found for this identifier. Please register first.');
    }

    return this._finalizeRoleLogin(user, targetRole, clientInfo);
  }

  async getFarmerOnboardingStatus(userId) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      user: this.sanitizeUser(user),
      farmerProfile: user.farmerProfile,
      farmerOnboarding: computeFarmerOnboardingState(user),
    };
  }

  async saveFarmerIdentityStep(userId, sessionId, payload) {
    const existing = await authRepository.findUserById(userId);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    const aadhaarInfo = maskAadhaar(payload.aadhaarNumber);

    const updatedUser = await authRepository.saveFarmerIdentityStep(userId, {
      fullName: payload.fullName,
      fatherOrSpouseName: payload.fatherOrSpouseName,
      maskedAadhaar: aadhaarInfo.masked,
      aadhaarLast4: aadhaarInfo.last4,
      aadhaarHash: aadhaarInfo.hash,
      verificationMethod: payload.verificationMethod,
      profilePhotoKey: payload.profilePhotoKey,
      aadhaarDocumentKey: payload.aadhaarDocumentKey,
      digiLockerReferenceId: payload.digiLockerReferenceId,
    });

    if (sessionId) {
      invalidateAuthCache(sessionId);
    }

    return {
      user: this.sanitizeUser(updatedUser),
      farmerProfile: updatedUser.farmerProfile,
      aadhaarDocument: formatAadhaarDocument(updatedUser.documents?.[0] || null),
      farmerOnboarding: computeFarmerOnboardingState(updatedUser),
    };
  }

  async saveFarmerLocationStep(userId, sessionId, payload) {
    const existing = await authRepository.findUserById(userId);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    const mappedAcres = mapLandSizeToAcres(payload.landSizeRange, payload.landAreaAcres);

    const updatedUser = await authRepository.saveFarmerLocationStep(userId, {
      state: payload.state,
      district: payload.district,
      tehsilOrBlock: payload.tehsilOrBlock,
      village: payload.village,
      pinCode: payload.pinCode,
      landSizeRange: payload.landSizeRange,
      landAreaAcres: mappedAcres,
      primaryProduce: payload.primaryProduce,
      latitude: payload.latitude,
      longitude: payload.longitude,
      gpsAccuracyMeters: payload.gpsAccuracyMeters,
    });

    if (sessionId) {
      invalidateAuthCache(sessionId);
    }

    const sanitized = this.sanitizeUser(updatedUser);

    return {
      user: sanitized,
      farmerProfile: updatedUser.farmerProfile,
      farmAddress: sanitized.farmAddress,
      farmerOnboarding: computeFarmerOnboardingState(updatedUser),
    };
  }

  async saveFarmerPayoutStep(userId, sessionId, payload) {
    const existing = await authRepository.findUserById(userId);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    const currentState = computeFarmerOnboardingState(existing);
    if (!currentState.steps.locationCompleted) {
      throw new BadRequestError(
        'Please complete Identity and Farm Location details before saving payout information.'
      );
    }

    const accountHolderName = payload.accountHolderName || existing.name || 'Farmer';
    const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS);

    const { user: updatedUser, defaultBankAccount, tokens } =
      await authRepository.saveFarmerPayoutStep(
        userId,
        sessionId,
        {
          payoutChannel: payload.payoutChannel,
          accountHolderName,
          accountNumber: payload.accountNumber,
          ifscCode: payload.ifscCode,
          bankName: payload.bankName,
          branchName: payload.branchName,
          upiVpa: payload.upiVpa,
          metadata: {
            consentAcceptedAt: new Date().toISOString(),
            source: 'FARMER_EKYC_STEP_3',
          },
        },
        newExpiresAt,
        this.issueTokensBound
      );

    if (sessionId) {
      invalidateAuthCache(sessionId);
    }

    return {
      ...(tokens && {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }),
      activeRole: 'FARMER',
      roles: updatedUser.roles.map((r) => r.role),
      user: this.sanitizeUser(updatedUser),
      farmerProfile: updatedUser.farmerProfile,
      defaultBankAccount: formatBankAccount(defaultBankAccount),
      farmerOnboarding: computeFarmerOnboardingState(updatedUser),
    };
  }

  async onboardFarmer(userId, farmerData, sessionId) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const mappedAcres = mapLandSizeToAcres(farmerData.landSizeRange, farmerData.landAreaAcres);
    const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS);

    const { user: updatedUser, farmerProfile, tokens } = await authRepository.onboardFarmer(
      userId,
      {
        ...farmerData,
        landAreaAcres: mappedAcres,
      },
      sessionId,
      newExpiresAt,
      this.issueTokensBound
    );

    if (sessionId) {
      invalidateAuthCache(sessionId);
    }

    return {
      ...(tokens && {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }),
      activeRole: 'FARMER',
      roles: updatedUser.roles.map((r) => r.role),
      user: this.sanitizeUser(updatedUser),
      farmerProfile,
      farmerOnboarding: computeFarmerOnboardingState(updatedUser),
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

    if (hashSha256(refreshTokenStr) !== session.refreshTokenHash) {
      await authRepository.revokeSession(session.id);
      invalidateAuthCache(session.id);
      throw new UnauthorizedError('Refresh token has been rotated or revoked. Please log in again.');
    }

    const user = await authRepository.findUserById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is inactive or not found');
    }

    const tokens = this.generateTokens(user, session.id, session.activeRole);
    const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await authRepository.rotateSessionRefreshToken(
      session.id,
      hashSha256(tokens.refreshToken),
      newExpiresAt
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeRole: session.activeRole,
    };
  }

  async logout(sessionId) {
    if (sessionId) {
      await authRepository.revokeSession(sessionId);
      invalidateAuthCache(sessionId);
    }
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async verifyIdentifier(userId, identifier, channel, otp) {
    const normalizedIdentifier = normalizeIdentifier(identifier, channel);
    const purpose = channel === 'EMAIL' ? 'VERIFY_EMAIL' : 'VERIFY_PHONE';
    await this.verifyOtpCode(normalizedIdentifier, purpose, otp);

    try {
      const updatedUser = await authRepository.verifySecondaryIdentifier(
        userId,
        normalizedIdentifier,
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
      farmerOnboarding: computeFarmerOnboardingState(user),
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
      if (targetRole === 'FARMER') {
        throw new ForbiddenError('Farmer onboarding is required before entering Farmer mode.');
      }
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

    const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const tokens = await authRepository.switchSessionRoleAndRotateTokens(
      session.id,
      user,
      targetRole,
      newExpiresAt,
      this.issueTokensBound
    );

    invalidateAuthCache(session.id);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeRole: targetRole,
      roles: userRoles,
      staffAssignments: this.formatStaffAssignments(user.staffAssignments),
      user: this.sanitizeUser(user),
      farmerOnboarding: computeFarmerOnboardingState(user),
    };
  }
}

export const authService = new AuthService();
