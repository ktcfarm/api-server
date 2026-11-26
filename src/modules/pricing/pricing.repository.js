import { Prisma } from '@prisma/client';
import { prisma } from '../../core/database/prisma.js';

const RATE_INCLUDE = {
  hub: {
    select: {
      id: true,
      code: true,
      name: true,
      cityOrTown: true,
      district: true,
      state: true,
      isActive: true,
    },
  },
  cropVariety: {
    select: {
      id: true,
      cropId: true,
      slug: true,
      name: true,
      translations: true,
      unitConversions: true,
      gradeSpecs: true,
      isActive: true,
      crop: {
        select: {
          id: true,
          categoryId: true,
          slug: true,
          name: true,
          translations: true,
          baseUnit: true,
          unitConversions: true,
          perishabilityType: true,
          category: {
            select: {
              id: true,
              slug: true,
              name: true,
              translations: true,
            },
          },
        },
      },
    },
  },
};

export class PricingRepository {
  async runInTransaction(fn, options = { maxWait: 10000, timeout: 30000 }) {
    return prisma.$transaction(fn, options);
  }

  async createAuditLog(tx, entry) {
    return (tx || prisma).auditLog.create({
      data: {
        actorUserId: entry.actorUserId || null,
        actorRole: entry.actorRole || null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: entry.oldValue ?? Prisma.JsonNull,
        newValue: entry.newValue ?? Prisma.JsonNull,
        metadata: entry.metadata ?? Prisma.JsonNull,
      },
    });
  }

  async createAuditLogsMany(tx, entries = []) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return { count: 0 };
    }
    return (tx || prisma).auditLog.createMany({
      data: entries.map((entry) => ({
        actorUserId: entry.actorUserId || null,
        actorRole: entry.actorRole || null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: entry.oldValue ?? Prisma.JsonNull,
        newValue: entry.newValue ?? Prisma.JsonNull,
        metadata: entry.metadata ?? Prisma.JsonNull,
      })),
    });
  }

  async findVarietyWithCrop(varietyId, tx = null) {
    return (tx || prisma).cropVariety.findUnique({
      where: { id: varietyId },
      relationLoadStrategy: 'join',
      include: {
        crop: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async findVarietiesByIds(varietyIds = []) {
    if (!Array.isArray(varietyIds) || varietyIds.length === 0) {
      return [];
    }
    return prisma.cropVariety.findMany({
      where: { id: { in: varietyIds } },
      relationLoadStrategy: 'join',
      include: {
        crop: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async findHubById(hubId, tx = null) {
    return (tx || prisma).ktsHub.findUnique({
      where: { id: hubId },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    });
  }

  async findHubsByIds(hubIds = []) {
    if (!Array.isArray(hubIds) || hubIds.length === 0) {
      return [];
    }
    return prisma.ktsHub.findMany({
      where: { id: { in: hubIds } },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    });
  }

  async findRateById(id, tx = null) {
    return (tx || prisma).mandiRate.findUnique({
      where: { id },
      relationLoadStrategy: 'join',
      include: RATE_INCLUDE,
    });
  }

  async findDraftRateByKey({ hubId, cropVarietyId, gradeCode, rateDate }, tx = null) {
    return (tx || prisma).mandiRate.findFirst({
      where: {
        hubId: hubId ?? null,
        cropVarietyId,
        gradeCode,
        rateDate,
        status: 'DRAFT',
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async archiveConflictingPublishedRates(
    { hubId, cropVarietyId, gradeCode, rateDate, excludeId = null },
    tx = null
  ) {
    return (tx || prisma).mandiRate.updateMany({
      where: {
        hubId: hubId ?? null,
        cropVarietyId,
        gradeCode,
        rateDate,
        status: 'PUBLISHED',
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: {
        status: 'ARCHIVED',
      },
    });
  }

  async createRate(data, tx = null) {
    return (tx || prisma).mandiRate.create({
      data: {
        hubId: data.hubId ?? null,
        cropVarietyId: data.cropVarietyId,
        grade: data.grade ?? null,
        gradeCode: data.gradeCode,
        rateDate: data.rateDate,
        minRatePerUnit: data.minRatePerUnit,
        maxRatePerUnit: data.maxRatePerUnit,
        baseRatePerUnit: data.baseRatePerUnit,
        farmerBuyRate: data.farmerBuyRate,
        consumerSellRate: data.consumerSellRate,
        marginPercent: data.marginPercent,
        bulkTiers: data.bulkTiers ?? Prisma.JsonNull,
        unit: data.unit,
        trend: data.trend ?? 'STABLE',
        apmcDelta: data.apmcDelta ?? null,
        status: data.status ?? 'DRAFT',
        isProcurementActive: data.isProcurementActive ?? true,
        notes: data.notes ?? null,
        createdById: data.createdById ?? null,
        updatedById: data.updatedById ?? null,
        publishedById: data.publishedById ?? null,
        publishedAt: data.publishedAt ?? null,
        metadata: data.metadata ?? Prisma.JsonNull,
      },
      include: RATE_INCLUDE,
    });
  }

  async updateRate(id, data, tx = null) {
    return (tx || prisma).mandiRate.update({
      where: { id },
      data: {
        ...(data.grade !== undefined && { grade: data.grade }),
        ...(data.gradeCode !== undefined && { gradeCode: data.gradeCode }),
        ...(data.rateDate !== undefined && { rateDate: data.rateDate }),
        ...(data.minRatePerUnit !== undefined && { minRatePerUnit: data.minRatePerUnit }),
        ...(data.maxRatePerUnit !== undefined && { maxRatePerUnit: data.maxRatePerUnit }),
        ...(data.baseRatePerUnit !== undefined && { baseRatePerUnit: data.baseRatePerUnit }),
        ...(data.farmerBuyRate !== undefined && { farmerBuyRate: data.farmerBuyRate }),
        ...(data.consumerSellRate !== undefined && { consumerSellRate: data.consumerSellRate }),
        ...(data.marginPercent !== undefined && { marginPercent: data.marginPercent }),
        ...(data.bulkTiers !== undefined && {
          bulkTiers: data.bulkTiers === null ? Prisma.JsonNull : data.bulkTiers,
        }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.trend !== undefined && { trend: data.trend }),
        ...(data.apmcDelta !== undefined && { apmcDelta: data.apmcDelta }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.isProcurementActive !== undefined && {
          isProcurementActive: data.isProcurementActive,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.updatedById !== undefined && { updatedById: data.updatedById }),
        ...(data.publishedById !== undefined && { publishedById: data.publishedById }),
        ...(data.publishedAt !== undefined && { publishedAt: data.publishedAt }),
        ...(data.metadata !== undefined && {
          metadata: data.metadata === null ? Prisma.JsonNull : data.metadata,
        }),
      },
      include: RATE_INCLUDE,
    });
  }

  async findActivePublishedRate({ varietyId, hubId = null, gradeCode, asOfDate }) {
    return prisma.mandiRate.findFirst({
      where: {
        cropVarietyId: varietyId,
        hubId: hubId ?? null,
        gradeCode,
        status: 'PUBLISHED',
        isProcurementActive: true,
        rateDate: { lte: asOfDate },
      },
      orderBy: [{ rateDate: 'desc' }, { updatedAt: 'desc' }],
      relationLoadStrategy: 'join',
      include: RATE_INCLUDE,
    });
  }

  async listRates(filters) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const where = {};
    const andConditions = [];

    if (Array.isArray(filters.allowedHubIds)) {
      if (filters.hubId) {
        if (!filters.allowedHubIds.includes(filters.hubId)) {
          return {
            items: [],
            meta: { page, limit, total: 0, totalPages: 1 },
          };
        }
        where.hubId = filters.hubId;
      } else if (filters.scope === 'global') {
        where.hubId = null;
      } else if (filters.scope === 'hub') {
        if (filters.allowedHubIds.length === 0) {
          return {
            items: [],
            meta: { page, limit, total: 0, totalPages: 1 },
          };
        }
        where.hubId = { in: filters.allowedHubIds };
      } else {
        andConditions.push({
          OR: [
            { hubId: null },
            ...(filters.allowedHubIds.length > 0
              ? [{ hubId: { in: filters.allowedHubIds } }]
              : []),
          ],
        });
      }
    } else if (filters.hubId) {
      where.hubId = filters.hubId;
    } else if (filters.scope === 'global') {
      where.hubId = null;
    } else if (filters.scope === 'hub') {
      where.hubId = { not: null };
    }

    if (filters.varietyId) {
      where.cropVarietyId = filters.varietyId;
    }

    const cropWhere = {};
    if (filters.categoryId) {
      cropWhere.categoryId = filters.categoryId;
    }
    if (filters.cropId) {
      where.cropVariety = {
        cropId: filters.cropId,
        ...(Object.keys(cropWhere).length > 0 ? { crop: cropWhere } : {}),
      };
    } else if (Object.keys(cropWhere).length > 0) {
      where.cropVariety = { crop: cropWhere };
    }

    if (filters.gradeCode) {
      where.gradeCode = { equals: filters.gradeCode, mode: 'insensitive' };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.effectiveDate) {
      where.rateDate = new Date(`${filters.effectiveDate}T00:00:00.000Z`);
    }

    if (filters.search) {
      const q = filters.search.trim();
      andConditions.push({
        OR: [
          { gradeCode: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
          { cropVariety: { name: { contains: q, mode: 'insensitive' } } },
          { cropVariety: { translations: { path: ['hi'], string_contains: q } } },
          { cropVariety: { crop: { name: { contains: q, mode: 'insensitive' } } } },
          { hub: { name: { contains: q, mode: 'insensitive' } } },
          { hub: { code: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const allowedSortFields = [
      'rateDate',
      'farmerBuyRate',
      'consumerSellRate',
      'marginPercent',
      'createdAt',
    ];
    const orderField = allowedSortFields.includes(filters.sortBy)
      ? filters.sortBy
      : 'rateDate';
    const orderDirection = filters.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      prisma.mandiRate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [orderField]: orderDirection }, { updatedAt: 'desc' }],
        relationLoadStrategy: 'join',
        include: RATE_INCLUDE,
      }),
      prisma.mandiRate.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}

export const pricingRepository = new PricingRepository();
