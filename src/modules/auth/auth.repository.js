import crypto from 'node:crypto';
import { prisma } from '../../core/database/prisma.js';
import { extractIdentifierCandidates, hashSha256 } from './auth.utils.js';

const USER_AUTH_INCLUDE = {
  roles: true,
  staffAssignments: {
    where: { isActive: true },
    include: {
      hub: {
        select: {
          id: true,
          code: true,
          name: true,
          cityOrTown: true,
          isActive: true,
        },
      },
    },
  },
  buyerProfile: true,
  farmerProfile: true,
  documents: {
    where: { docType: 'AADHAAR' },
    orderBy: { updatedAt: 'desc' },
    take: 1,
  },
  bankAccounts: {
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  },
  addresses: {
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  },
};

export class AuthRepository {
  async findLatestUnusedOtp(identifier, purpose) {
    const candidates = extractIdentifierCandidates(identifier);
    return prisma.otpVerification.findFirst({
      where: {
        identifier: { in: candidates },
        purpose,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async invalidateOtps(identifier, purpose) {
    const candidates = extractIdentifierCandidates(identifier);
    return prisma.otpVerification.updateMany({
      where: {
        identifier: { in: candidates },
        purpose,
        isUsed: false,
      },
      data: { isUsed: true },
    });
  }

  async createOtp(data) {
    return prisma.otpVerification.create({
      data: {
        identifier: data.identifier,
        channel: data.channel,
        purpose: data.purpose,
        otpHash: data.otpHash,
        expiresAt: data.expiresAt,
        metadata: data.metadata || null,
      },
    });
  }

  async incrementOtpAttempts(otpId) {
    return prisma.otpVerification.update({
      where: { id: otpId },
      data: { attempts: { increment: 1 } },
    });
  }

  async markOtpUsed(otpId) {
    return prisma.otpVerification.update({
      where: { id: otpId },
      data: { isUsed: true },
    });
  }

  async findVerifiedUserByIdentifier(identifier) {
    const candidates = extractIdentifierCandidates(identifier);
    return prisma.user.findFirst({
      where: {
        OR: [
          { email: { in: candidates }, emailVerifiedAt: { not: null } },
          { phone: { in: candidates }, phoneVerifiedAt: { not: null } },
        ],
      },
      relationLoadStrategy: 'join',
      include: USER_AUTH_INCLUDE,
    });
  }

  async findVerifiedUserByChannel(identifier, channel) {
    const candidates = extractIdentifierCandidates(identifier);
    if (channel === 'EMAIL') {
      return prisma.user.findFirst({
        where: { email: { in: candidates }, emailVerifiedAt: { not: null } },
        select: { id: true, email: true },
      });
    }
    if (channel === 'SMS') {
      return prisma.user.findFirst({
        where: { phone: { in: candidates }, phoneVerifiedAt: { not: null } },
        select: { id: true, phone: true },
      });
    }
    return null;
  }

  async findUserById(userId, tx = prisma) {
    return tx.user.findUnique({
      where: { id: userId },
      relationLoadStrategy: 'join',
      include: USER_AUTH_INCLUDE,
    });
  }

  async registerUserWithProfiles(params, issueSessionTokens) {
    const {
      email,
      phone,
      name,
      pinHash,
      languagePref,
      termsAcceptedAt,
      intendedRole,
      farmerDetails,
      sessionData,
    } = params;

    return prisma.$transaction(
      async (tx) => {
        const existingVerifiedEmail = await tx.user.findFirst({
          where: { email, emailVerifiedAt: { not: null } },
        });
        if (existingVerifiedEmail) {
          throw new Error('EMAIL_ALREADY_VERIFIED');
        }

        await tx.user.updateMany({
          where: { email, emailVerifiedAt: null },
          data: { email: null },
        });

        if (phone) {
          const existingVerifiedPhone = await tx.user.findFirst({
            where: { phone, phoneVerifiedAt: { not: null } },
          });
          if (existingVerifiedPhone) {
            throw new Error('PHONE_ALREADY_VERIFIED');
          }

          await tx.user.updateMany({
            where: { phone, phoneVerifiedAt: null },
            data: { phone: null },
          });
        }

        const user = await tx.user.create({
          data: {
            email,
            emailVerifiedAt: new Date(),
            phone: phone || null,
            name,
            pinHash,
            languagePref: languagePref || 'en',
            termsAcceptedAt: termsAcceptedAt || new Date(),
            status: 'ACTIVE',
            metadata: {
              signupRole: intendedRole,
              termsAcceptedAt: (termsAcceptedAt || new Date()).toISOString(),
            },
          },
        });

        await tx.userRole.create({
          data: {
            userId: user.id,
            role: 'BUYER',
          },
        });

        await tx.buyerProfile.create({
          data: {
            userId: user.id,
            businessType: 'INDIVIDUAL',
          },
        });

        if (intendedRole === 'FARMER') {
          await tx.userRole.create({
            data: {
              userId: user.id,
              role: 'FARMER',
            },
          });

          const hasLocationFields = Boolean(
            farmerDetails?.village &&
              farmerDetails?.district &&
              farmerDetails?.state &&
              farmerDetails?.pinCode
          );

          await tx.farmerProfile.create({
            data: {
              userId: user.id,
              fatherName: farmerDetails?.fatherName || null,
              village: farmerDetails?.village || null,
              tehsilOrBlock: farmerDetails?.tehsilOrBlock || null,
              district: farmerDetails?.district || null,
              state: farmerDetails?.state || null,
              pinCode: farmerDetails?.pinCode || null,
              landSizeRange: farmerDetails?.landSizeRange || null,
              landAreaAcres: farmerDetails?.landAreaAcres || null,
              primaryProduce: farmerDetails?.primaryProduce || [],
              onboardingStep: hasLocationFields ? 'LOCATION' : 'NOT_STARTED',
            },
          });
        }

        const session = await tx.userSession.create({
          data: {
            userId: user.id,
            refreshTokenHash: crypto.randomUUID(),
            activeRole: intendedRole,
            deviceInfo: sessionData.deviceInfo || null,
            ipAddress: sessionData.ipAddress || null,
            expiresAt: sessionData.expiresAt,
          },
        });

        const tokens = issueSessionTokens(user, session.id, intendedRole);

        await tx.userSession.update({
          where: { id: session.id },
          data: { refreshTokenHash: hashSha256(tokens.refreshToken) },
        });

        const fullUser = await this.findUserById(user.id, tx);
        return { user: fullUser, session, tokens };
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }

  async recordFailedPinAttempt(userId, failedCount, lockUntil = null) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        failedPinAttempts: failedCount,
        pinLockedUntil: lockUntil,
      },
    });
  }

  async resetPinAttempts(userId) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
    });
  }

  async updateUserPinAndClearSessions(userId, pinHash) {
    return prisma.$transaction(
      async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data: {
            pinHash,
            failedPinAttempts: 0,
            pinLockedUntil: null,
          },
        });

        await tx.userSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        return user;
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }

  async createSessionWithTokens(data, issueSessionTokens, user) {
    return prisma.$transaction(
      async (tx) => {
        const session = await tx.userSession.create({
          data: {
            userId: data.userId,
            refreshTokenHash: crypto.randomUUID(),
            activeRole: data.activeRole,
            deviceInfo: data.deviceInfo || null,
            ipAddress: data.ipAddress || null,
            expiresAt: data.expiresAt,
          },
        });

        const tokens = issueSessionTokens(user, session.id, data.activeRole);

        await tx.userSession.update({
          where: { id: session.id },
          data: { refreshTokenHash: hashSha256(tokens.refreshToken) },
        });

        return { session, tokens };
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  async findSessionById(sessionId) {
    return prisma.userSession.findUnique({
      where: { id: sessionId },
    });
  }

  async rotateSessionRefreshToken(sessionId, newRefreshTokenHash, newExpiresAt) {
    return prisma.userSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: newExpiresAt,
      },
    });
  }

  async revokeSession(sessionId) {
    return prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async switchSessionRoleAndRotateTokens(sessionId, user, targetRole, newExpiresAt, issueSessionTokens) {
    return prisma.$transaction(
      async (tx) => {
        const tokens = issueSessionTokens(user, sessionId, targetRole);
        await tx.userSession.update({
          where: { id: sessionId },
          data: {
            activeRole: targetRole,
            refreshTokenHash: hashSha256(tokens.refreshToken),
            expiresAt: newExpiresAt,
          },
        });
        return tokens;
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  async ensureFarmerRole(tx, userId) {
    return tx.userRole.upsert({
      where: {
        userId_role: {
          userId,
          role: 'FARMER',
        },
      },
      create: {
        userId,
        role: 'FARMER',
      },
      update: {},
    });
  }

  async saveFarmerIdentityStep(userId, payload) {
    return prisma.$transaction(
      async (tx) => {
        await this.ensureFarmerRole(tx, userId);

        await tx.user.update({
          where: { id: userId },
          data: {
            name: payload.fullName,
            ...(payload.profilePhotoKey !== undefined && {
              avatarKey: payload.profilePhotoKey,
            }),
          },
        });

        const existingProfile = await tx.farmerProfile.findUnique({
          where: { userId },
        });

        const nextStep =
          existingProfile &&
          (existingProfile.onboardingStep === 'LOCATION' ||
            existingProfile.onboardingStep === 'COMPLETED')
            ? existingProfile.onboardingStep
            : 'IDENTITY';

        await tx.farmerProfile.upsert({
          where: { userId },
          create: {
            userId,
            fatherName: payload.fatherOrSpouseName || null,
            onboardingStep: nextStep,
          },
          update: {
            ...(payload.fatherOrSpouseName !== undefined && {
              fatherName: payload.fatherOrSpouseName || null,
            }),
            onboardingStep: nextStep,
          },
        });

        const existingAadhaarDoc = await tx.userDocument.findFirst({
          where: { userId, docType: 'AADHAAR' },
          orderBy: { updatedAt: 'desc' },
        });

        const docData = {
          docNumber: payload.maskedAadhaar,
          ...(payload.aadhaarDocumentKey !== undefined && {
            r2PrivateKey: payload.aadhaarDocumentKey,
          }),
          status: 'PENDING',
          providerMetadata: {
            verificationMethod: payload.verificationMethod,
            digiLockerReferenceId: payload.digiLockerReferenceId || null,
            submittedAt: new Date().toISOString(),
          },
          metadata: {
            aadhaarLast4: payload.aadhaarLast4,
            aadhaarHash: payload.aadhaarHash,
            consentAcceptedAt: new Date().toISOString(),
          },
        };

        if (existingAadhaarDoc) {
          await tx.userDocument.update({
            where: { id: existingAadhaarDoc.id },
            data: docData,
          });
        } else {
          await tx.userDocument.create({
            data: {
              userId,
              docType: 'AADHAAR',
              r2PrivateKey: payload.aadhaarDocumentKey || null,
              ...docData,
            },
          });
        }

        return this.findUserById(userId, tx);
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }

  async saveFarmerLocationStep(userId, payload) {
    return prisma.$transaction(
      async (tx) => {
        await this.ensureFarmerRole(tx, userId);

        const existingUser = await tx.user.findUnique({
          where: { id: userId },
          select: { name: true, phone: true, email: true },
        });

        const existingProfile = await tx.farmerProfile.findUnique({
          where: { userId },
        });

        const nextStep =
          existingProfile?.onboardingStep === 'COMPLETED' ? 'COMPLETED' : 'LOCATION';

        await tx.farmerProfile.upsert({
          where: { userId },
          create: {
            userId,
            state: payload.state,
            district: payload.district,
            tehsilOrBlock: payload.tehsilOrBlock,
            village: payload.village,
            pinCode: payload.pinCode,
            landSizeRange: payload.landSizeRange || null,
            landAreaAcres: payload.landAreaAcres,
            primaryProduce: payload.primaryProduce,
            onboardingStep: nextStep,
          },
          update: {
            state: payload.state,
            district: payload.district,
            tehsilOrBlock: payload.tehsilOrBlock,
            village: payload.village,
            pinCode: payload.pinCode,
            landSizeRange: payload.landSizeRange || null,
            landAreaAcres: payload.landAreaAcres,
            primaryProduce: payload.primaryProduce,
            onboardingStep: nextStep,
          },
        });

        const existingFarmAddress = await tx.address.findFirst({
          where: { userId, label: 'FARM' },
          orderBy: { updatedAt: 'desc' },
        });

        const addressData = {
          isDefault: true,
          contactName: existingUser?.name || 'Farmer',
          contactPhone: existingUser?.phone || existingUser?.email || '',
          addressLine1: `${payload.village}, ${payload.tehsilOrBlock}`,
          tehsilOrBlock: payload.tehsilOrBlock,
          cityOrTown: payload.village,
          district: payload.district,
          state: payload.state,
          pinCode: payload.pinCode,
          country: 'IN',
          latitude: payload.latitude ?? null,
          longitude: payload.longitude ?? null,
          metadata: {
            gpsAccuracyMeters: payload.gpsAccuracyMeters ?? null,
          },
        };

        const farmAddress = existingFarmAddress
          ? await tx.address.update({
              where: { id: existingFarmAddress.id },
              data: addressData,
            })
          : await tx.address.create({
              data: {
                userId,
                label: 'FARM',
                ...addressData,
              },
            });

        if (payload.latitude != null && payload.longitude != null) {
          await tx.$executeRaw`
            UPDATE "Address"
            SET location = ST_SetSRID(ST_MakePoint(${payload.longitude}, ${payload.latitude}), 4326)::geography
            WHERE id = ${farmAddress.id}
          `;
        }

        return this.findUserById(userId, tx);
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }

  async upsertUserPayoutAccount(tx, userId, payoutData, setAsDefault = true) {
    if (setAsDefault) {
      await tx.bankAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const matchWhere =
      payoutData.payoutChannel === 'BANK'
        ? {
            userId,
            payoutChannel: 'BANK',
            accountNumber: payoutData.accountNumber,
            ifscCode: payoutData.ifscCode,
          }
        : {
            userId,
            payoutChannel: 'UPI',
            upiVpa: payoutData.upiVpa,
          };

    const existing = await tx.bankAccount.findFirst({ where: matchWhere });

    const recordData = {
      payoutChannel: payoutData.payoutChannel,
      accountHolderName: payoutData.accountHolderName,
      accountNumber: payoutData.payoutChannel === 'BANK' ? payoutData.accountNumber : null,
      ifscCode: payoutData.payoutChannel === 'BANK' ? payoutData.ifscCode : null,
      bankName: payoutData.payoutChannel === 'BANK' ? payoutData.bankName || null : null,
      branchName: payoutData.payoutChannel === 'BANK' ? payoutData.branchName || null : null,
      upiVpa: payoutData.payoutChannel === 'UPI' ? payoutData.upiVpa : null,
      isDefault: setAsDefault,
      metadata: payoutData.metadata || null,
    };

    if (existing) {
      return tx.bankAccount.update({
        where: { id: existing.id },
        data: recordData,
      });
    }

    return tx.bankAccount.create({
      data: {
        userId,
        ...recordData,
      },
    });
  }

  async saveFarmerPayoutStep(userId, sessionId, payoutData, newExpiresAt, issueSessionTokens) {
    return prisma.$transaction(
      async (tx) => {
        await this.ensureFarmerRole(tx, userId);

        const defaultBankAccount = await this.upsertUserPayoutAccount(
          tx,
          userId,
          payoutData,
          true
        );

        const existingProfile = await tx.farmerProfile.findUnique({
          where: { userId },
          select: { metadata: true },
        });
        const mergedMetadata =
          existingProfile?.metadata && typeof existingProfile.metadata === 'object'
            ? { ...existingProfile.metadata, onboardingCompletedAt: new Date().toISOString() }
            : { onboardingCompletedAt: new Date().toISOString() };

        await tx.farmerProfile.update({
          where: { userId },
          data: {
            onboardingStep: 'COMPLETED',
            metadata: mergedMetadata,
          },
        });

        const updatedUser = await this.findUserById(userId, tx);
        let tokens = null;

        if (sessionId) {
          tokens = issueSessionTokens(updatedUser, sessionId, 'FARMER');
          await tx.userSession.update({
            where: { id: sessionId },
            data: {
              activeRole: 'FARMER',
              refreshTokenHash: hashSha256(tokens.refreshToken),
              expiresAt: newExpiresAt,
            },
          });
        }

        return { user: updatedUser, defaultBankAccount, tokens };
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }

  async onboardFarmer(userId, farmerData, sessionId, newExpiresAt, issueSessionTokens) {
    return prisma.$transaction(
      async (tx) => {
        await this.ensureFarmerRole(tx, userId);

        const farmerProfile = await tx.farmerProfile.upsert({
          where: { userId },
          create: {
            userId,
            fatherName: farmerData.fatherName || null,
            village: farmerData.village,
            tehsilOrBlock: farmerData.tehsilOrBlock,
            district: farmerData.district,
            state: farmerData.state,
            pinCode: farmerData.pinCode,
            landSizeRange: farmerData.landSizeRange || null,
            landAreaAcres: farmerData.landAreaAcres || null,
            primaryProduce: farmerData.primaryProduce || [],
            onboardingStep: 'LOCATION',
          },
          update: {
            fatherName: farmerData.fatherName || null,
            village: farmerData.village,
            tehsilOrBlock: farmerData.tehsilOrBlock,
            district: farmerData.district,
            state: farmerData.state,
            pinCode: farmerData.pinCode,
            ...(farmerData.landSizeRange !== undefined && {
              landSizeRange: farmerData.landSizeRange || null,
            }),
            landAreaAcres: farmerData.landAreaAcres || null,
            ...(farmerData.primaryProduce !== undefined && {
              primaryProduce: farmerData.primaryProduce,
            }),
          },
        });

        const updatedUser = await this.findUserById(userId, tx);
        let tokens = null;

        if (sessionId) {
          tokens = issueSessionTokens(updatedUser, sessionId, 'FARMER');
          await tx.userSession.update({
            where: { id: sessionId },
            data: {
              activeRole: 'FARMER',
              refreshTokenHash: hashSha256(tokens.refreshToken),
              expiresAt: newExpiresAt,
            },
          });
        }

        return { user: updatedUser, farmerProfile, tokens };
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }

  async verifySecondaryIdentifier(userId, identifier, channel) {
    return prisma.$transaction(
      async (tx) => {
        if (channel === 'EMAIL') {
          const existing = await tx.user.findFirst({
            where: { email: identifier, emailVerifiedAt: { not: null } },
          });
          if (existing && existing.id !== userId) {
            throw new Error('EMAIL_ALREADY_VERIFIED');
          }

          await tx.user.updateMany({
            where: { email: identifier, emailVerifiedAt: null },
            data: { email: null },
          });

          return tx.user.update({
            where: { id: userId },
            data: {
              email: identifier,
              emailVerifiedAt: new Date(),
            },
          });
        }

        if (channel === 'SMS') {
          const existing = await tx.user.findFirst({
            where: { phone: identifier, phoneVerifiedAt: { not: null } },
          });
          if (existing && existing.id !== userId) {
            throw new Error('PHONE_ALREADY_VERIFIED');
          }

          await tx.user.updateMany({
            where: { phone: identifier, phoneVerifiedAt: null },
            data: { phone: null },
          });

          return tx.user.update({
            where: { id: userId },
            data: {
              phone: identifier,
              phoneVerifiedAt: new Date(),
            },
          });
        }

        throw new Error('INVALID_CHANNEL');
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }
}

export const authRepository = new AuthRepository();
