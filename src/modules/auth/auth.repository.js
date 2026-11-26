import { prisma } from '../../core/database/prisma.js';

export class AuthRepository {
  async findLatestUnusedOtp(identifier, purpose) {
    return prisma.otpVerification.findFirst({
      where: {
        identifier,
        purpose,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async invalidateOtps(identifier, purpose) {
    return prisma.otpVerification.updateMany({
      where: {
        identifier,
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
    return prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier, emailVerifiedAt: { not: null } },
          { phone: identifier, phoneVerifiedAt: { not: null } },
        ],
      },
      include: {
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
      },
    });
  }

  async findUserById(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
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
      },
    });
  }

  async registerUserWithProfiles(params) {
    const {
      email,
      phone,
      name,
      pinHash,
      intendedRole,
      farmerDetails,
      sessionData,
    } = params;

    return prisma.$transaction(async (tx) => {
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
          status: 'ACTIVE',
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

        await tx.farmerProfile.create({
          data: {
            userId: user.id,
            fatherName: farmerDetails?.fatherName || null,
            village: farmerDetails?.village || null,
            tehsilOrBlock: farmerDetails?.tehsilOrBlock || null,
            district: farmerDetails?.district || null,
            state: farmerDetails?.state || null,
            pinCode: farmerDetails?.pinCode || null,
            landAreaAcres: farmerDetails?.landAreaAcres || null,
          },
        });
      }

      const session = await tx.userSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: sessionData.refreshTokenHash,
          activeRole: intendedRole,
          deviceInfo: sessionData.deviceInfo || null,
          ipAddress: sessionData.ipAddress || null,
          expiresAt: sessionData.expiresAt,
        },
      });

      const fullUser = await tx.user.findUnique({
        where: { id: user.id },
        include: {
          roles: true,
          staffAssignments: { where: { isActive: true } },
          buyerProfile: true,
          farmerProfile: true,
        },
      });

      return { user: fullUser, session };
    });
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
    return prisma.$transaction(async (tx) => {
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
    });
  }

  async createSession(data) {
    return prisma.userSession.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        activeRole: data.activeRole,
        deviceInfo: data.deviceInfo || null,
        ipAddress: data.ipAddress || null,
        expiresAt: data.expiresAt,
      },
    });
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
    return prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async updateSessionActiveRole(sessionId, activeRole) {
    return prisma.userSession.update({
      where: { id: sessionId },
      data: { activeRole },
    });
  }

  async onboardFarmer(userId, farmerData, sessionId = null) {
    return prisma.$transaction(async (tx) => {
      const existingRole = await tx.userRole.findUnique({
        where: {
          userId_role: {
            userId,
            role: 'FARMER',
          },
        },
      });

      if (!existingRole) {
        await tx.userRole.create({
          data: {
            userId,
            role: 'FARMER',
          },
        });
      }

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
          landAreaAcres: farmerData.landAreaAcres || null,
        },
        update: {
          fatherName: farmerData.fatherName || null,
          village: farmerData.village,
          tehsilOrBlock: farmerData.tehsilOrBlock,
          district: farmerData.district,
          state: farmerData.state,
          pinCode: farmerData.pinCode,
          landAreaAcres: farmerData.landAreaAcres || null,
        },
      });

      if (sessionId) {
        await tx.userSession.update({
          where: { id: sessionId },
          data: { activeRole: 'FARMER' },
        });
      }

      const updatedUser = await tx.user.findUnique({
        where: { id: userId },
        include: {
          roles: true,
          staffAssignments: { where: { isActive: true } },
          buyerProfile: true,
          farmerProfile: true,
        },
      });

      return { user: updatedUser, farmerProfile };
    });
  }

  async verifySecondaryIdentifier(userId, identifier, channel) {
    return prisma.$transaction(async (tx) => {
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
    });
  }
}

export const authRepository = new AuthRepository();
