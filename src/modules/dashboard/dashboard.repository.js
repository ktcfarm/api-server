import { prisma } from '../../core/database/prisma.js';

export class DashboardRepository {
  async findHubSummaryById(hubId) {
    return prisma.ktsHub.findUnique({
      where: { id: hubId },
      select: {
        id: true,
        code: true,
        name: true,
        cityOrTown: true,
        state: true,
        isActive: true,
        onboardingStatus: true,
      },
    });
  }

  async getSummaryMetrics({
    scopedHubIds = null,
    actorUserId = null,
    todayStart,
    todayEnd,
    expiryThreshold,
  }) {
    const isHubScoped = Array.isArray(scopedHubIds);
    const hubIdsFilter = isHubScoped ? { in: scopedHubIds } : undefined;
    const hubWhere = isHubScoped ? { id: hubIdsFilter } : {};

    const rateScopeWhere = isHubScoped
      ? {
          OR: [
            { hubId: null },
            ...(scopedHubIds.length > 0 ? [{ hubId: hubIdsFilter }] : []),
          ],
        }
      : {};

    const unratedVarietyWhere = {
      isActive: true,
      mandiRates: {
        none: {
          status: 'PUBLISHED',
          isProcurementActive: true,
          ...rateScopeWhere,
        },
      },
    };

    const hubOverrideWhere = isHubScoped
      ? {
          hubId: hubIdsFilter,
          status: 'PUBLISHED',
          isProcurementActive: true,
        }
      : {
          hubId: { not: null },
          status: 'PUBLISHED',
          isProcurementActive: true,
        };

    const staffWhere = isHubScoped
      ? { isActive: true, hubId: hubIdsFilter }
      : { isActive: true };

    const docsWhere = {
      ...(isHubScoped ? { hubId: hubIdsFilter } : {}),
      expiryDate: { not: null, lte: expiryThreshold },
      verificationStatus: { in: ['PENDING', 'APPROVED'] },
    };

    const auditWhere = isHubScoped
      ? {
          OR: [
            { entityType: 'KtsHub', entityId: hubIdsFilter },
            ...scopedHubIds.map((hid) => ({
              newValue: { path: ['hubId'], equals: hid },
            })),
            ...scopedHubIds.map((hid) => ({
              oldValue: { path: ['hubId'], equals: hid },
            })),
            ...scopedHubIds.map((hid) => ({
              metadata: { path: ['hubId'], equals: hid },
            })),
            ...(actorUserId ? [{ actorUserId }] : []),
          ],
        }
      : {};

    const [
      totalHubs,
      activeHubs,
      pendingVerificationHubsCount,
      verifiedHubsCount,
      assignedStaffCount,
      activeCategories,
      cropGroups,
      activeVarieties,
      publishedRates,
      publishedTodayRates,
      draftRates,
      marginAggregate,
      activeHubOverrides,
      pendingVerificationHubs,
      unratedVarietiesCount,
      unratedVarietySamples,
      expiringDocuments,
      recentActivity,
    ] = await Promise.all([
      prisma.ktsHub.count({ where: hubWhere }),
      prisma.ktsHub.count({ where: { ...hubWhere, isActive: true } }),
      prisma.ktsHub.count({
        where: { ...hubWhere, onboardingStatus: 'PENDING_VERIFICATION' },
      }),
      prisma.ktsHub.count({
        where: { ...hubWhere, onboardingStatus: 'VERIFIED' },
      }),
      prisma.hubStaffAssignment.count({ where: staffWhere }),
      prisma.category.count({ where: { isActive: true } }),
      prisma.crop.groupBy({
        by: ['perishabilityType'],
        _count: { _all: true },
      }),
      prisma.cropVariety.count({ where: { isActive: true } }),
      prisma.mandiRate.count({
        where: {
          ...rateScopeWhere,
          status: 'PUBLISHED',
          isProcurementActive: true,
        },
      }),
      prisma.mandiRate.count({
        where: {
          ...rateScopeWhere,
          status: 'PUBLISHED',
          rateDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.mandiRate.count({
        where: {
          ...rateScopeWhere,
          status: 'DRAFT',
        },
      }),
      prisma.mandiRate.aggregate({
        where: {
          ...rateScopeWhere,
          status: 'PUBLISHED',
          isProcurementActive: true,
        },
        _avg: {
          marginPercent: true,
        },
      }),
      prisma.mandiRate.count({ where: hubOverrideWhere }),
      prisma.ktsHub.findMany({
        where: { ...hubWhere, onboardingStatus: 'PENDING_VERIFICATION' },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          code: true,
          name: true,
          cityOrTown: true,
          state: true,
        },
      }),
      prisma.cropVariety.count({ where: unratedVarietyWhere }),
      prisma.cropVariety.findMany({
        where: unratedVarietyWhere,
        take: 5,
        orderBy: { name: 'asc' },
        relationLoadStrategy: 'join',
        select: {
          id: true,
          name: true,
          crop: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.hubDocument.findMany({
        where: docsWhere,
        take: 5,
        orderBy: { expiryDate: 'asc' },
        relationLoadStrategy: 'join',
        select: {
          id: true,
          hubId: true,
          documentType: true,
          expiryDate: true,
          verificationStatus: true,
          hub: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      }),
      prisma.auditLog.findMany({
        where: auditWhere,
        take: 5,
        orderBy: { createdAt: 'desc' },
        relationLoadStrategy: 'join',
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          actorRole: true,
          createdAt: true,
          actor: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      totalHubs,
      activeHubs,
      pendingVerificationHubsCount,
      verifiedHubsCount,
      assignedStaffCount,
      activeCategories,
      cropGroups,
      activeVarieties,
      publishedRates,
      publishedTodayRates,
      draftRates,
      avgMarginPercent: marginAggregate?._avg?.marginPercent ?? null,
      activeHubOverrides,
      pendingVerificationHubs,
      unratedVarietiesCount,
      unratedVarietySamples,
      expiringDocuments,
      recentActivity,
    };
  }
}

export const dashboardRepository = new DashboardRepository();
