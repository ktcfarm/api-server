import { prisma } from '../../core/database/prisma.js';

export class HubsRepository {
  async createHub(data) {
    return prisma.$transaction(async (tx) => {
      const hub = await tx.ktsHub.create({
        data: {
          code: data.code,
          name: data.name,
          translations: data.translations || {},
          addressLine: data.addressLine,
          cityOrTown: data.cityOrTown,
          district: data.district,
          state: data.state,
          pinCode: data.pinCode,
          contactPhone: data.contactPhone || null,
          operatingHours: data.operatingHours || null,
          latitude: data.latitude,
          longitude: data.longitude,
          isActive: true,
          metadata: data.metadata || null,
        },
      });

      await tx.$executeRaw`
        UPDATE "KtsHub"
        SET location = ST_SetSRID(ST_MakePoint(${data.longitude}, ${data.latitude}), 4326)::geography
        WHERE id = ${hub.id}
      `;

      await tx.cashAccount.create({
        data: {
          type: 'HUB_SAFE',
          hubId: hub.id,
          balance: 0,
          currency: 'INR',
          isActive: true,
        },
      });

      return hub;
    });
  }

  async updateHub(id, data) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.ktsHub.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.translations !== undefined && { translations: data.translations }),
          ...(data.addressLine !== undefined && { addressLine: data.addressLine }),
          ...(data.cityOrTown !== undefined && { cityOrTown: data.cityOrTown }),
          ...(data.district !== undefined && { district: data.district }),
          ...(data.state !== undefined && { state: data.state }),
          ...(data.pinCode !== undefined && { pinCode: data.pinCode }),
          ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
          ...(data.operatingHours !== undefined && { operatingHours: data.operatingHours }),
          ...(data.latitude !== undefined && { latitude: data.latitude }),
          ...(data.longitude !== undefined && { longitude: data.longitude }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.metadata !== undefined && { metadata: data.metadata }),
        },
      });

      if (data.latitude !== undefined || data.longitude !== undefined) {
        const lat = data.latitude !== undefined ? data.latitude : Number(updated.latitude);
        const lng = data.longitude !== undefined ? data.longitude : Number(updated.longitude);

        await tx.$executeRaw`
          UPDATE "KtsHub"
          SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
          WHERE id = ${id}
        `;
      }

      return updated;
    });
  }

  async findHubById(id) {
    return prisma.ktsHub.findUnique({
      where: { id },
      include: {
        cashAccounts: {
          where: { isActive: true },
          select: {
            id: true,
            type: true,
            balance: true,
            currency: true,
          },
        },
      },
    });
  }

  async findHubByCode(code) {
    return prisma.ktsHub.findUnique({
      where: { code },
    });
  }

  async listHubs(filters = {}) {
    const { cityOrTown, district, state, isActive, limit = 50, offset = 0 } = filters;

    return prisma.ktsHub.findMany({
      where: {
        ...(cityOrTown && { cityOrTown: { contains: cityOrTown, mode: 'insensitive' } }),
        ...(district && { district: { contains: district, mode: 'insensitive' } }),
        ...(state && { state: { contains: state, mode: 'insensitive' } }),
        ...(isActive !== undefined && { isActive }),
      },
      take: limit,
      skip: offset,
      orderBy: { name: 'asc' },
    });
  }

  async findNearbyHubs(longitude, latitude, radiusMeters) {
    const results = await prisma.$queryRaw`
      SELECT 
        id, 
        code, 
        name, 
        translations, 
        "addressLine", 
        "cityOrTown", 
        district, 
        state, 
        "pinCode", 
        "contactPhone", 
        "operatingHours", 
        "isActive", 
        latitude, 
        longitude, 
        metadata, 
        "createdAt", 
        "updatedAt",
        ROUND((ST_Distance(location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography) / 1000)::numeric, 2) AS "distanceKm"
      FROM "KtsHub"
      WHERE "isActive" = true
        AND location IS NOT NULL
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${radiusMeters})
      ORDER BY "distanceKm" ASC
    `;

    return results.map((r) => ({
      ...r,
      distanceKm: parseFloat(r.distanceKm) || 0,
    }));
  }

  async findAddressById(addressId) {
    return prisma.address.findUnique({
      where: { id: addressId },
    });
  }

  async findDefaultAddressForUser(userId) {
    return prisma.address.findFirst({
      where: { userId, isDefault: true },
    });
  }

  async assignStaff(hubId, userId, role, metadata = null) {
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.hubStaffAssignment.upsert({
        where: {
          hubId_userId_role: {
            hubId,
            userId,
            role,
          },
        },
        create: {
          hubId,
          userId,
          role,
          isActive: true,
          metadata,
        },
        update: {
          isActive: true,
          metadata,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      const userRoleExists = await tx.userRole.findUnique({
        where: {
          userId_role: {
            userId,
            role,
          },
        },
      });

      if (!userRoleExists) {
        await tx.userRole.create({
          data: {
            userId,
            role,
          },
        });
      }

      if (role === 'STORE_OPERATOR') {
        const existingCashAccount = await tx.cashAccount.findFirst({
          where: {
            ownerUserId: userId,
            hubId,
            type: 'OPERATOR_CASH_IN_HAND',
          },
        });

        if (!existingCashAccount) {
          await tx.cashAccount.create({
            data: {
              type: 'OPERATOR_CASH_IN_HAND',
              ownerUserId: userId,
              hubId,
              balance: 0,
              currency: 'INR',
              isActive: true,
            },
          });
        }
      }

      return assignment;
    });
  }

  async findStaffByHubId(hubId) {
    return prisma.hubStaffAssignment.findMany({
      where: { hubId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeStaff(hubId, staffAssignmentId) {
    return prisma.$transaction(async (tx) => {
      const staff = await tx.hubStaffAssignment.findUnique({
        where: { id: staffAssignmentId },
      });

      if (!staff || staff.hubId !== hubId) {
        return null;
      }

      const updated = await tx.hubStaffAssignment.update({
        where: { id: staffAssignmentId },
        data: { isActive: false },
      });

      if (staff.role === 'STORE_OPERATOR') {
        await tx.cashAccount.updateMany({
          where: {
            ownerUserId: staff.userId,
            hubId,
            type: 'OPERATOR_CASH_IN_HAND',
          },
          data: { isActive: false },
        });
      }

      return updated;
    });
  }
}

export const hubsRepository = new HubsRepository();
