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
    }, { maxWait: 10000, timeout: 30000 });
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
    }, { maxWait: 10000, timeout: 30000 });
  }

  async findHubById(id) {
    return prisma.ktsHub.findUnique({
      where: { id },
      relationLoadStrategy: 'join',
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
        _count: {
          select: {
            staffAssignments: {
              where: { isActive: true },
            },
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
    }, { maxWait: 10000, timeout: 30000 });
  }

  async findStaffByHubId(hubId) {
    return prisma.hubStaffAssignment.findMany({
      where: { hubId, isActive: true },
      relationLoadStrategy: 'join',
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
    const staff = await prisma.hubStaffAssignment.findUnique({
      where: { id: staffAssignmentId },
    });

    if (!staff || staff.hubId !== hubId) {
      return null;
    }

    return prisma.$transaction(
      async (tx) => {
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
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }

  async listAdminHubs({
    page = 1,
    limit = 10,
    search,
    state,
    district,
    hubId,
    hubIds = null,
    onboardingStatus,
    isActive,
    sortBy = 'name',
    sortOrder = 'asc',
  } = {}) {
    if (Array.isArray(hubIds) && hubIds.length === 0) {
      return { items: [], total: 0 };
    }

    const where = {
      ...(isActive !== undefined && { isActive }),
      ...(onboardingStatus && { onboardingStatus }),
      ...(state && { state: { contains: state, mode: 'insensitive' } }),
      ...(district && { district: { contains: district, mode: 'insensitive' } }),
    };

    if (Array.isArray(hubIds)) {
      if (hubId) {
        if (!hubIds.includes(hubId)) {
          return { items: [], total: 0 };
        }
        where.id = hubId;
      } else {
        where.id = { in: hubIds };
      }
    } else if (hubId) {
      where.id = hubId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { cityOrTown: { contains: search, mode: 'insensitive' } },
        { district: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.ktsHub.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        relationLoadStrategy: 'join',
        include: {
          _count: {
            select: {
              staffAssignments: {
                where: { isActive: true },
              },
            },
          },
        },
      }),
      prisma.ktsHub.count({ where }),
    ]);

    const items = rows.map(({ _count, ...hub }) => ({
      ...hub,
      activeStaffCount: _count?.staffAssignments ?? 0,
    }));

    return { items, total };
  }

  async searchStaffCandidates(search, limit = 10) {
    const users = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { name: 'asc' },
      relationLoadStrategy: 'join',
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        roles: {
          select: { role: true },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      status: u.status,
      roles: u.roles.map((r) => r.role),
    }));
  }

  async findAdminHubById(id) {
    return prisma.ktsHub.findUnique({
      where: { id },
      relationLoadStrategy: 'join',
      include: {
        franchiseProfile: true,
        documents: {
          orderBy: { documentType: 'asc' },
        },
        cashAccounts: {
          where: { isActive: true },
          select: {
            id: true,
            type: true,
            balance: true,
            currency: true,
          },
        },
        _count: {
          select: {
            staffAssignments: {
              where: { isActive: true },
            },
          },
        },
      },
    });
  }

  async upsertFranchiseProfile(hubId, data) {
    return prisma.hubFranchiseProfile.upsert({
      where: { hubId },
      create: {
        hubId,
        entityType: data.entityType,
        ownerName: data.ownerName,
        ownerPhone: data.ownerPhone,
        ownerEmail: data.ownerEmail ?? null,
        panNumber: data.panNumber ?? null,
        gstin: data.gstin ?? null,
        fssaiNumber: data.fssaiNumber ?? null,
        bankAccountHolder: data.bankAccountHolder ?? null,
        bankAccountNumber: data.bankAccountNumber ?? null,
        bankIfsc: data.bankIfsc ?? null,
        bankName: data.bankName ?? null,
        franchiseModel: data.franchiseModel || 'FOFO',
        commissionPercent: data.commissionPercent ?? null,
        securityDepositAmount: data.securityDepositAmount ?? null,
        maxCashLimit: data.maxCashLimit ?? null,
        metadata: data.metadata ?? null,
      },
      update: {
        entityType: data.entityType,
        ownerName: data.ownerName,
        ownerPhone: data.ownerPhone,
        ownerEmail: data.ownerEmail ?? null,
        panNumber: data.panNumber ?? null,
        gstin: data.gstin ?? null,
        fssaiNumber: data.fssaiNumber ?? null,
        bankAccountHolder: data.bankAccountHolder ?? null,
        bankAccountNumber: data.bankAccountNumber ?? null,
        bankIfsc: data.bankIfsc ?? null,
        bankName: data.bankName ?? null,
        franchiseModel: data.franchiseModel || 'FOFO',
        commissionPercent: data.commissionPercent ?? null,
        securityDepositAmount: data.securityDepositAmount ?? null,
        maxCashLimit: data.maxCashLimit ?? null,
        ...(data.metadata !== undefined && { metadata: data.metadata }),
      },
    });
  }

  async upsertHubDocument(hubId, data) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.hubDocument.findFirst({
        where: {
          hubId,
          documentType: data.documentType,
        },
      });

      if (existing) {
        return tx.hubDocument.update({
          where: { id: existing.id },
          data: {
            bucketType: data.bucketType,
            storageKey: data.storageKey,
            fileName: data.fileName,
            mimeType: data.mimeType,
            documentNumber: data.documentNumber ?? null,
            expiryDate: data.expiryDate ?? null,
            verificationStatus: 'PENDING',
            rejectionReason: null,
            verifiedById: null,
            verifiedAt: null,
            ...(data.metadata !== undefined && { metadata: data.metadata }),
          },
        });
      }

      return tx.hubDocument.create({
        data: {
          hubId,
          documentType: data.documentType,
          bucketType: data.bucketType,
          storageKey: data.storageKey,
          fileName: data.fileName,
          mimeType: data.mimeType,
          documentNumber: data.documentNumber ?? null,
          expiryDate: data.expiryDate ?? null,
          verificationStatus: 'PENDING',
          metadata: data.metadata ?? null,
        },
      });
    }, { maxWait: 10000, timeout: 30000 });
  }

  async findHubDocumentById(hubId, docId) {
    return prisma.hubDocument.findFirst({
      where: {
        id: docId,
        hubId,
      },
    });
  }

  async verifyHubDocument(docId, { verificationStatus, rejectionReason, verifiedById, verifiedAt }) {
    return prisma.hubDocument.update({
      where: { id: docId },
      data: {
        verificationStatus,
        rejectionReason: verificationStatus === 'REJECTED' ? rejectionReason : null,
        verifiedById,
        verifiedAt,
      },
    });
  }

  async findHubDocumentsByHubId(hubId) {
    return prisma.hubDocument.findMany({
      where: { hubId },
      orderBy: { documentType: 'asc' },
    });
  }

  async updateOnboardingStatus(hubId, onboardingStatus) {
    return prisma.ktsHub.update({
      where: { id: hubId },
      data: { onboardingStatus },
    });
  }
}

export const hubsRepository = new HubsRepository();
