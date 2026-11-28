import { prisma } from '../../core/database/prisma.js';
import { authRepository } from '../auth/auth.repository.js';
import { formatUserPreferences } from '../auth/auth.utils.js';

export class ProfileRepository {
  async updateBasicProfile(userId, updates) {
    return prisma.$transaction(
      async (tx) => {
        let mergedPreferences;
        if (updates.preferences !== undefined) {
          const existing = await tx.user.findUnique({
            where: { id: userId },
            select: { preferences: true },
          });
          const base = formatUserPreferences(existing?.preferences);
          mergedPreferences = {
            ...base,
            ...updates.preferences,
          };
        }

        if (
          updates.name !== undefined ||
          updates.languagePref !== undefined ||
          updates.avatarKey !== undefined ||
          mergedPreferences !== undefined
        ) {
          await tx.user.update({
            where: { id: userId },
            data: {
              ...(updates.name !== undefined && { name: updates.name }),
              ...(updates.languagePref !== undefined && {
                languagePref: updates.languagePref,
              }),
              ...(updates.avatarKey !== undefined && { avatarKey: updates.avatarKey }),
              ...(mergedPreferences !== undefined && { preferences: mergedPreferences }),
            },
          });
        }

        if (updates.buyerProfile !== undefined) {
          const bp = updates.buyerProfile;
          await tx.buyerProfile.upsert({
            where: { userId },
            create: {
              userId,
              businessName: bp.businessName ?? null,
              businessType: bp.businessType ?? 'INDIVIDUAL',
              gstin: bp.gstin ?? null,
              panNumber: bp.panNumber ?? null,
              city: bp.city ?? null,
            },
            update: {
              ...(bp.businessName !== undefined && { businessName: bp.businessName }),
              ...(bp.businessType !== undefined && { businessType: bp.businessType }),
              ...(bp.gstin !== undefined && { gstin: bp.gstin }),
              ...(bp.panNumber !== undefined && { panNumber: bp.panNumber }),
              ...(bp.city !== undefined && { city: bp.city }),
            },
          });
        }

        return authRepository.findUserById(userId, tx);
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  async listBankAccounts(userId) {
    return prisma.bankAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createOrUpdateBankAccount(userId, payload, setAsDefault = true) {
    return prisma.$transaction(
      async (tx) => {
        const count = await tx.bankAccount.count({ where: { userId } });
        const shouldBeDefault = setAsDefault || count === 0;
        return authRepository.upsertUserPayoutAccount(tx, userId, payload, shouldBeDefault);
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  async setDefaultBankAccount(userId, bankAccountId) {
    return prisma.$transaction(
      async (tx) => {
        const target = await tx.bankAccount.findFirst({
          where: { id: bankAccountId, userId },
        });
        if (!target) {
          return null;
        }

        await tx.bankAccount.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });

        return tx.bankAccount.update({
          where: { id: bankAccountId },
          data: { isDefault: true },
        });
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  async deleteBankAccount(userId, bankAccountId) {
    return prisma.$transaction(
      async (tx) => {
        const target = await tx.bankAccount.findFirst({
          where: { id: bankAccountId, userId },
          include: {
            _count: {
              select: { payouts: true },
            },
          },
        });
        if (!target) {
          return { status: 'NOT_FOUND' };
        }
        if (target._count.payouts > 0) {
          return { status: 'HAS_PAYOUTS' };
        }

        await tx.bankAccount.delete({
          where: { id: bankAccountId },
        });

        if (target.isDefault) {
          const fallback = await tx.bankAccount.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
          });
          if (fallback) {
            await tx.bankAccount.update({
              where: { id: fallback.id },
              data: { isDefault: true },
            });
          }
        }

        return { status: 'DELETED' };
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  async listDeliveryAddresses(userId) {
    return prisma.address.findMany({
      where: { userId, label: { not: 'FARM' } },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createDeliveryAddress(userId, payload) {
    return prisma.$transaction(
      async (tx) => {
        const count = await tx.address.count({
          where: { userId, label: { not: 'FARM' } },
        });
        const shouldBeDefault = Boolean(payload.isDefault) || count === 0;

        if (shouldBeDefault) {
          await tx.address.updateMany({
            where: { userId, isDefault: true, label: { not: 'FARM' } },
            data: { isDefault: false },
          });
        }

        const created = await tx.address.create({
          data: {
            userId,
            label: payload.label,
            isDefault: shouldBeDefault,
            contactName: payload.contactName,
            contactPhone: payload.contactPhone,
            addressLine1: payload.addressLine1,
            addressLine2: payload.addressLine2 || null,
            landmark: payload.landmark || null,
            tehsilOrBlock: payload.tehsilOrBlock || null,
            cityOrTown: payload.cityOrTown,
            district: payload.district,
            state: payload.state,
            pinCode: payload.pinCode,
            country: payload.country || 'IN',
            latitude: payload.latitude ?? null,
            longitude: payload.longitude ?? null,
            metadata: {
              title: payload.title,
              facilityType: payload.facilityType || payload.label,
              bayShort: payload.bayShort || payload.facilityType || 'Front Door',
              altMobile: payload.altMobile || null,
              hasWeighbridge: payload.hasWeighbridge ?? false,
              supportsHeavyTruck: payload.supportsHeavyTruck ?? false,
              requiresForklift: payload.requiresForklift ?? false,
            },
          },
        });

        if (payload.latitude != null && payload.longitude != null) {
          await tx.$executeRaw`
            UPDATE "Address"
            SET location = ST_SetSRID(ST_MakePoint(${payload.longitude}, ${payload.latitude}), 4326)::geography
            WHERE id = ${created.id}
          `;
        }

        return created;
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  async updateDeliveryAddress(userId, addressId, payload) {
    return prisma.$transaction(
      async (tx) => {
        const existing = await tx.address.findFirst({
          where: { id: addressId, userId, label: { not: 'FARM' } },
        });
        if (!existing) {
          return null;
        }

        if (payload.isDefault === true) {
          await tx.address.updateMany({
            where: { userId, isDefault: true, label: { not: 'FARM' } },
            data: { isDefault: false },
          });
        }

        const prevMeta =
          existing.metadata && typeof existing.metadata === 'object'
            ? existing.metadata
            : {};

        const mergedMeta = {
          ...prevMeta,
          ...(payload.title !== undefined && { title: payload.title }),
          ...(payload.facilityType !== undefined && {
            facilityType: payload.facilityType,
          }),
          ...(payload.bayShort !== undefined && { bayShort: payload.bayShort }),
          ...(payload.altMobile !== undefined && { altMobile: payload.altMobile }),
          ...(payload.hasWeighbridge !== undefined && {
            hasWeighbridge: payload.hasWeighbridge,
          }),
          ...(payload.supportsHeavyTruck !== undefined && {
            supportsHeavyTruck: payload.supportsHeavyTruck,
          }),
          ...(payload.requiresForklift !== undefined && {
            requiresForklift: payload.requiresForklift,
          }),
        };

        const updated = await tx.address.update({
          where: { id: addressId },
          data: {
            ...(payload.label !== undefined && { label: payload.label }),
            ...(payload.isDefault !== undefined && { isDefault: payload.isDefault }),
            ...(payload.contactName !== undefined && {
              contactName: payload.contactName,
            }),
            ...(payload.contactPhone !== undefined && {
              contactPhone: payload.contactPhone,
            }),
            ...(payload.addressLine1 !== undefined && {
              addressLine1: payload.addressLine1,
            }),
            ...(payload.addressLine2 !== undefined && {
              addressLine2: payload.addressLine2,
            }),
            ...(payload.landmark !== undefined && { landmark: payload.landmark }),
            ...(payload.tehsilOrBlock !== undefined && {
              tehsilOrBlock: payload.tehsilOrBlock,
            }),
            ...(payload.cityOrTown !== undefined && { cityOrTown: payload.cityOrTown }),
            ...(payload.district !== undefined && { district: payload.district }),
            ...(payload.state !== undefined && { state: payload.state }),
            ...(payload.pinCode !== undefined && { pinCode: payload.pinCode }),
            ...(payload.country !== undefined && { country: payload.country }),
            ...(payload.latitude !== undefined && { latitude: payload.latitude }),
            ...(payload.longitude !== undefined && { longitude: payload.longitude }),
            metadata: mergedMeta,
          },
        });

        if (payload.latitude != null && payload.longitude != null) {
          await tx.$executeRaw`
            UPDATE "Address"
            SET location = ST_SetSRID(ST_MakePoint(${payload.longitude}, ${payload.latitude}), 4326)::geography
            WHERE id = ${updated.id}
          `;
        } else if (payload.latitude === null && payload.longitude === null) {
          await tx.$executeRaw`
            UPDATE "Address"
            SET location = NULL
            WHERE id = ${updated.id}
          `;
        }

        return updated;
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  async setDefaultDeliveryAddress(userId, addressId) {
    return prisma.$transaction(
      async (tx) => {
        const target = await tx.address.findFirst({
          where: { id: addressId, userId, label: { not: 'FARM' } },
        });
        if (!target) {
          return null;
        }

        await tx.address.updateMany({
          where: { userId, isDefault: true, label: { not: 'FARM' } },
          data: { isDefault: false },
        });

        return tx.address.update({
          where: { id: addressId },
          data: { isDefault: true },
        });
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }

  async deleteDeliveryAddress(userId, addressId) {
    return prisma.$transaction(
      async (tx) => {
        const target = await tx.address.findFirst({
          where: { id: addressId, userId, label: { not: 'FARM' } },
          include: {
            _count: {
              select: { orders: true },
            },
          },
        });
        if (!target) {
          return { status: 'NOT_FOUND' };
        }
        if (target._count.orders > 0) {
          return { status: 'HAS_ORDERS' };
        }

        await tx.address.delete({
          where: { id: addressId },
        });

        if (target.isDefault) {
          const fallback = await tx.address.findFirst({
            where: { userId, label: { not: 'FARM' } },
            orderBy: { updatedAt: 'desc' },
          });
          if (fallback) {
            await tx.address.update({
              where: { id: fallback.id },
              data: { isDefault: true },
            });
          }
        }

        return { status: 'DELETED' };
      },
      { maxWait: 10000, timeout: 15000 }
    );
  }
}

export const profileRepository = new ProfileRepository();
