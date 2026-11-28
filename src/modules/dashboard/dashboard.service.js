import { ForbiddenError, NotFoundError } from '../../core/errors/app.error.js';
import { dashboardRepository } from './dashboard.repository.js';

function getEffectiveActorRole(actor) {
  if (!actor) return null;
  if (actor.activeRole) return actor.activeRole;
  const roles = Array.isArray(actor.roles) ? actor.roles : [];
  if (roles.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (roles.includes('ADMIN')) return 'ADMIN';
  return roles[0] || null;
}

export class DashboardService {
  async getSummary(query, actor) {
    const effectiveRole = getEffectiveActorRole(actor);
    const userRoles = Array.isArray(actor?.roles) ? actor.roles : [];
    const isSuperAdminHolder = userRoles.includes('SUPER_ADMIN');
    const isGlobalRole =
      effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMIN';

    let scopedHubIds = null;
    let scopedHub = null;
    let scope = 'NETWORK';

    if (isGlobalRole) {
      if (query?.hubId) {
        const hub = await dashboardRepository.findHubSummaryById(query.hubId);
        if (!hub) {
          throw new NotFoundError('KTC Hub not found.');
        }
        scopedHubIds = [hub.id];
        scopedHub = { id: hub.id, code: hub.code, name: hub.name };
        scope = 'HUB';
      }
    } else {
      const assignedHubIds = (actor?.staffAssignments || [])
        .filter((s) => s.isActive && s.role === effectiveRole)
        .map((s) => s.hubId);

      if (query?.hubId) {
        if (!isSuperAdminHolder && !assignedHubIds.includes(query.hubId)) {
          throw new ForbiddenError(
            'Access restricted to your assigned KTC hub(s).'
          );
        }
        const hub = await dashboardRepository.findHubSummaryById(query.hubId);
        if (!hub) {
          throw new NotFoundError('KTC Hub not found.');
        }
        scopedHubIds = [hub.id];
        scopedHub = { id: hub.id, code: hub.code, name: hub.name };
        scope = 'HUB';
      } else if (!isSuperAdminHolder) {
        scopedHubIds = assignedHubIds;
        scope = 'HUB';
      } else if (assignedHubIds.length > 0) {
        scopedHubIds = assignedHubIds;
        scope = 'HUB';
      }
    }

    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const todayStart = new Date(`${todayIso}T00:00:00.000Z`);
    const todayEnd = new Date(`${todayIso}T23:59:59.999Z`);
    const expiryThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const metrics = await dashboardRepository.getSummaryMetrics({
      scopedHubIds,
      actorUserId: actor?.id || null,
      todayStart,
      todayEnd,
      expiryThreshold,
    });

    let perishableCrops = 0;
    let nonPerishableCrops = 0;
    for (const group of metrics.cropGroups) {
      if (group.perishabilityType === 'PERISHABLE') {
        perishableCrops = group._count._all;
      } else if (group.perishabilityType === 'NON_PERISHABLE') {
        nonPerishableCrops = group._count._all;
      }
    }

    const isStoreOperator = effectiveRole === 'STORE_OPERATOR';
    const avgMarginRounded =
      metrics.avgMarginPercent !== null && metrics.avgMarginPercent !== undefined
        ? Number(Number(metrics.avgMarginPercent).toFixed(2))
        : 0;

    const alertsTotalCount =
      metrics.pendingVerificationHubsCount +
      metrics.unratedVarietiesCount +
      metrics.expiringDocuments.length;

    return {
      scope,
      scopedHub,
      hubs: {
        total: metrics.totalHubs,
        active: metrics.activeHubs,
        pendingVerification: metrics.pendingVerificationHubsCount,
        verified: metrics.verifiedHubsCount,
        assignedStaff: metrics.assignedStaffCount,
      },
      catalog: {
        activeCategories: metrics.activeCategories,
        totalCrops: perishableCrops + nonPerishableCrops,
        perishableCrops,
        nonPerishableCrops,
        activeVarieties: metrics.activeVarieties,
      },
      pricing: {
        publishedRates: metrics.publishedRates,
        publishedTodayRates: metrics.publishedTodayRates,
        draftRates: isStoreOperator ? null : metrics.draftRates,
        avgMarginPercent: isStoreOperator ? null : avgMarginRounded,
        activeHubOverrides: metrics.activeHubOverrides,
      },
      alerts: {
        pendingVerificationHubs: metrics.pendingVerificationHubs,
        varietiesWithoutPublishedRate: {
          count: metrics.unratedVarietiesCount,
          samples: metrics.unratedVarietySamples.map((v) => ({
            id: v.id,
            name: v.name,
            cropName: v.crop?.name || '',
          })),
        },
        expiringDocuments: metrics.expiringDocuments.map((doc) => ({
          id: doc.id,
          hubId: doc.hubId,
          hubCode: doc.hub?.code || '',
          hubName: doc.hub?.name || '',
          documentType: doc.documentType,
          expiryDate: doc.expiryDate,
          verificationStatus: doc.verificationStatus,
        })),
        totalCount: alertsTotalCount,
      },
      recentActivity: metrics.recentActivity.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        actorRole: log.actorRole,
        actorName: log.actor?.name || log.actor?.email || 'System',
        createdAt: log.createdAt,
      })),
      generatedAt: now.toISOString(),
    };
  }
}

export const dashboardService = new DashboardService();
