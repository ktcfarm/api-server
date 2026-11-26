import { Prisma } from '@prisma/client';
import {
  BadRequestError,
  NotFoundError,
} from '../../core/errors/app.error.js';
import { ACTIONS } from '../../core/rbac/actions.js';
import { globalPolicyGuard } from '../../core/rbac/policy.guard.js';
import { pricingRepository } from './pricing.repository.js';
import { LEGACY_QUALITY_GRADES } from './pricing.validation.js';

function toUtcDateOnly(dateInput) {
  if (!dateInput) {
    const todayIso = new Date().toISOString().slice(0, 10);
    return new Date(`${todayIso}T00:00:00.000Z`);
  }
  if (dateInput instanceof Date) {
    return new Date(`${dateInput.toISOString().slice(0, 10)}T00:00:00.000Z`);
  }
  return new Date(`${String(dateInput).slice(0, 10)}T00:00:00.000Z`);
}

function getEffectiveActorRole(actor) {
  if (!actor) return null;
  if (actor.activeRole) return actor.activeRole;
  const roles = Array.isArray(actor.roles) ? actor.roles : [];
  if (roles.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (roles.includes('ADMIN')) return 'ADMIN';
  return roles[0] || null;
}

function normalizeGradeCode(raw) {
  return String(raw || 'GRADE_A')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extractVarietyGradeCodes(variety) {
  const specs = variety?.gradeSpecs;
  if (Array.isArray(specs) && specs.length > 0) {
    return specs
      .map((item) => normalizeGradeCode(item?.code))
      .filter(Boolean);
  }
  if (specs && typeof specs === 'object' && !Array.isArray(specs)) {
    const keys = Object.keys(specs).map(normalizeGradeCode).filter(Boolean);
    if (keys.length > 0) return keys;
  }
  return [];
}

function extractAllowedUnits(variety) {
  const baseUnit = variety?.crop?.baseUnit || 'KG';
  const cropConversions =
    variety?.crop?.unitConversions &&
    typeof variety.crop.unitConversions === 'object'
      ? variety.crop.unitConversions
      : {};
  const varietyConversions =
    variety?.unitConversions && typeof variety.unitConversions === 'object'
      ? variety.unitConversions
      : {};

  return new Set([
    baseUnit,
    ...Object.keys(cropConversions),
    ...Object.keys(varietyConversions),
  ]);
}

function computePricingMetrics({
  farmerBuyRate,
  consumerSellRate,
  minRatePerUnit,
  maxRatePerUnit,
  bulkTiers,
}) {
  const buyDec = new Prisma.Decimal(farmerBuyRate);
  const sellDec = new Prisma.Decimal(consumerSellRate);

  if (buyDec.lte(0) || sellDec.lte(0)) {
    throw new BadRequestError(
      'Farmer buy rate and consumer sell rate must both be greater than 0.'
    );
  }

  const marginPercent = sellDec
    .minus(buyDec)
    .div(buyDec)
    .mul(100)
    .toDecimalPlaces(2);

  const minDec =
    minRatePerUnit !== undefined && minRatePerUnit !== null
      ? new Prisma.Decimal(minRatePerUnit)
      : buyDec;
  const maxDec =
    maxRatePerUnit !== undefined && maxRatePerUnit !== null
      ? new Prisma.Decimal(maxRatePerUnit)
      : buyDec;

  if (minDec.gt(maxDec)) {
    throw new BadRequestError(
      'Minimum rate per unit cannot exceed maximum rate per unit.'
    );
  }

  let normalizedTiers = null;
  if (Array.isArray(bulkTiers) && bulkTiers.length > 0) {
    const sorted = [...bulkTiers].sort(
      (a, b) => Number(a.minQty) - Number(b.minQty)
    );
    const seenQty = new Set();

    normalizedTiers = sorted.map((tier) => {
      const qtyDec = new Prisma.Decimal(tier.minQty);
      const priceDec = new Prisma.Decimal(tier.unitPrice);
      const qtyKey = qtyDec.toString();

      if (seenQty.has(qtyKey)) {
        throw new BadRequestError(
          `Duplicate bulk tier minimum quantity "${qtyKey}" is not allowed.`
        );
      }
      seenQty.add(qtyKey);

      const discountPercent = sellDec
        .minus(priceDec)
        .div(sellDec)
        .mul(100)
        .toDecimalPlaces(2)
        .toNumber();

      return {
        minQty: qtyDec.toNumber(),
        unitPrice: priceDec.toNumber(),
        discountPercent,
        label: (tier.label || '').trim(),
      };
    });
  }

  return {
    farmerBuyRate: buyDec,
    consumerSellRate: sellDec,
    baseRatePerUnit: buyDec,
    minRatePerUnit: minDec,
    maxRatePerUnit: maxDec,
    marginPercent,
    bulkTiers: normalizedTiers,
  };
}

function formatRateRecord(rate) {
  if (!rate) return null;
  const buy = new Prisma.Decimal(rate.farmerBuyRate ?? rate.baseRatePerUnit ?? 0);
  const sell = new Prisma.Decimal(rate.consumerSellRate ?? 0);
  const effectiveDate = rate.rateDate
    ? new Date(rate.rateDate).toISOString().slice(0, 10)
    : null;

  return {
    ...rate,
    effectiveDate,
    farmerBuyRate: buy.toFixed(2),
    consumerSellRate: sell.toFixed(2),
    baseRatePerUnit: new Prisma.Decimal(rate.baseRatePerUnit ?? buy).toFixed(2),
    minRatePerUnit: new Prisma.Decimal(rate.minRatePerUnit ?? buy).toFixed(2),
    maxRatePerUnit: new Prisma.Decimal(rate.maxRatePerUnit ?? buy).toFixed(2),
    marginPercent: new Prisma.Decimal(rate.marginPercent ?? 0).toFixed(2),
    marginAmount: sell.minus(buy).toFixed(2),
    scope: rate.hubId ? 'HUB' : 'GLOBAL',
  };
}

export class PricingService {
  validateVarietyAndHubRecords({ variety, hub, hubId, gradeCode, unit }) {
    if (!variety) {
      throw new NotFoundError('Crop variety not found.');
    }

    const normalizedGradeCode = normalizeGradeCode(gradeCode);
    const configuredGrades = extractVarietyGradeCodes(variety);
    if (
      configuredGrades.length > 0 &&
      !configuredGrades.includes(normalizedGradeCode)
    ) {
      throw new BadRequestError(
        `Grade "${normalizedGradeCode}" is not configured for variety "${variety.name}". Allowed grades: ${configuredGrades.join(', ')}`
      );
    }

    const allowedUnits = extractAllowedUnits(variety);
    if (!allowedUnits.has(unit)) {
      throw new BadRequestError(
        `Unit "${unit}" is not supported for variety "${variety.name}". Allowed units: ${Array.from(allowedUnits).join(', ')}`
      );
    }

    if (hubId && !hub) {
      throw new NotFoundError('Target KTC hub not found.');
    }

    return {
      variety,
      gradeCode: normalizedGradeCode,
      legacyGrade: LEGACY_QUALITY_GRADES.includes(normalizedGradeCode)
        ? normalizedGradeCode
        : null,
    };
  }

  async validateVarietyAndHub({ cropVarietyId, hubId, gradeCode, unit }, tx = null) {
    const [variety, hub] = await Promise.all([
      pricingRepository.findVarietyWithCrop(cropVarietyId, tx),
      hubId ? pricingRepository.findHubById(hubId, tx) : Promise.resolve(null),
    ]);

    return this.validateVarietyAndHubRecords({
      variety,
      hub,
      hubId,
      gradeCode,
      unit,
    });
  }

  async enforceWritePolicy(hubId, actor) {
    const action = hubId
      ? ACTIONS.MANDI_RATE.SET_HUB
      : ACTIONS.MANDI_RATE.SET_GLOBAL;

    await globalPolicyGuard.enforce({
      user: actor,
      action,
      resource: 'MANDI_RATE',
      hubId: hubId ?? null,
    });
  }

  async listRates(filters, actor) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.MANDI_RATE.VIEW,
      resource: 'MANDI_RATE',
      hubId: filters.hubId ?? null,
    });

    const userRoles = Array.isArray(actor.roles) ? actor.roles : [];
    const isSuperAdminHolder = userRoles.includes('SUPER_ADMIN');
    const effectiveRole = getEffectiveActorRole(actor);
    const hasGlobalVisibility =
      isSuperAdminHolder ||
      effectiveRole === 'SUPER_ADMIN' ||
      effectiveRole === 'ADMIN';

    let allowedHubIds = null;
    if (!hasGlobalVisibility) {
      allowedHubIds = (actor.staffAssignments || [])
        .filter((s) => s.isActive && (!effectiveRole || s.role === effectiveRole))
        .map((s) => s.hubId);
    }

    const normalizedGrade = filters.gradeCode
      ? normalizeGradeCode(filters.gradeCode)
      : undefined;

    const result = await pricingRepository.listRates({
      ...filters,
      gradeCode: normalizedGrade,
      allowedHubIds,
    });

    return {
      items: result.items.map(formatRateRecord),
      meta: result.meta,
    };
  }

  async getRateById(id, actor) {
    const rate = await pricingRepository.findRateById(id);
    if (!rate) {
      throw new NotFoundError('Mandi rate record not found.');
    }

    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.MANDI_RATE.VIEW,
      resource: 'MANDI_RATE',
      hubId: rate.hubId ?? null,
    });

    return formatRateRecord(rate);
  }

  async createRate(data, actor) {
    const hubId = data.hubId ?? null;
    await this.enforceWritePolicy(hubId, actor);

    const effectiveRole = getEffectiveActorRole(actor);
    const rateDate = toUtcDateOnly(data.effectiveDate);

    const created = await pricingRepository.runInTransaction(async (tx) => {
      const { gradeCode, legacyGrade } = await this.validateVarietyAndHub(
        {
          cropVarietyId: data.cropVarietyId,
          hubId,
          gradeCode: data.gradeCode,
          unit: data.unit,
        },
        tx
      );

      const metrics = computePricingMetrics({
        farmerBuyRate: data.farmerBuyRate,
        consumerSellRate: data.consumerSellRate,
        minRatePerUnit: data.minRatePerUnit,
        maxRatePerUnit: data.maxRatePerUnit,
        bulkTiers: data.bulkTiers,
      });

      const status = data.status || 'DRAFT';
      if (status === 'PUBLISHED') {
        await pricingRepository.archiveConflictingPublishedRates(
          {
            hubId,
            cropVarietyId: data.cropVarietyId,
            gradeCode,
            rateDate,
          },
          tx
        );
      }

      const record = await pricingRepository.createRate(
        {
          hubId,
          cropVarietyId: data.cropVarietyId,
          grade: legacyGrade,
          gradeCode,
          rateDate,
          ...metrics,
          unit: data.unit,
          trend: data.trend || 'STABLE',
          apmcDelta:
            data.apmcDelta !== undefined && data.apmcDelta !== null
              ? new Prisma.Decimal(data.apmcDelta)
              : null,
          status,
          isProcurementActive: data.isProcurementActive ?? true,
          notes: data.notes ?? null,
          createdById: actor.id,
          updatedById: actor.id,
          publishedById: status === 'PUBLISHED' ? actor.id : null,
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          metadata: data.metadata ?? null,
        },
        tx
      );

      await pricingRepository.createAuditLog(tx, {
        actorUserId: actor.id,
        actorRole: effectiveRole,
        action: status === 'PUBLISHED' ? 'RATE_CREATED_PUBLISHED' : 'RATE_CREATED',
        entityType: 'MandiRate',
        entityId: record.id,
        newValue: formatRateRecord(record),
      });

      return record;
    });

    return formatRateRecord(created);
  }

  async updateRate(id, data, actor) {
    const existing = await pricingRepository.findRateById(id);
    if (!existing) {
      throw new NotFoundError('Mandi rate record not found.');
    }

    await this.enforceWritePolicy(existing.hubId ?? null, actor);

    const effectiveRole = getEffectiveActorRole(actor);
    const updated = await pricingRepository.runInTransaction(async (tx) => {
      const nextGradeCode = data.gradeCode ?? existing.gradeCode;
      const nextUnit = data.unit ?? existing.unit;

      const { gradeCode, legacyGrade } = await this.validateVarietyAndHub(
        {
          cropVarietyId: existing.cropVarietyId,
          hubId: existing.hubId ?? null,
          gradeCode: nextGradeCode,
          unit: nextUnit,
        },
        tx
      );

      const nextBuyRate =
        data.farmerBuyRate !== undefined
          ? data.farmerBuyRate
          : existing.farmerBuyRate;
      const nextSellRate =
        data.consumerSellRate !== undefined
          ? data.consumerSellRate
          : existing.consumerSellRate;

      const nextMinRate =
        data.minRatePerUnit !== undefined
          ? data.minRatePerUnit
          : data.farmerBuyRate !== undefined
            ? data.farmerBuyRate
            : existing.minRatePerUnit;
      const nextMaxRate =
        data.maxRatePerUnit !== undefined
          ? data.maxRatePerUnit
          : data.farmerBuyRate !== undefined
            ? data.farmerBuyRate
            : existing.maxRatePerUnit;

      const nextTiers =
        data.bulkTiers !== undefined ? data.bulkTiers : existing.bulkTiers;

      const metrics = computePricingMetrics({
        farmerBuyRate: nextBuyRate,
        consumerSellRate: nextSellRate,
        minRatePerUnit: nextMinRate,
        maxRatePerUnit: nextMaxRate,
        bulkTiers: nextTiers,
      });

      const nextRateDate = data.effectiveDate
        ? toUtcDateOnly(data.effectiveDate)
        : existing.rateDate;

      if (existing.status === 'PUBLISHED') {
        await pricingRepository.archiveConflictingPublishedRates(
          {
            hubId: existing.hubId ?? null,
            cropVarietyId: existing.cropVarietyId,
            gradeCode,
            rateDate: nextRateDate,
            excludeId: existing.id,
          },
          tx
        );
      }

      const record = await pricingRepository.updateRate(
        id,
        {
          grade: legacyGrade,
          gradeCode,
          rateDate: nextRateDate,
          ...metrics,
          unit: nextUnit,
          ...(data.trend !== undefined && { trend: data.trend }),
          ...(data.apmcDelta !== undefined && {
            apmcDelta:
              data.apmcDelta !== null ? new Prisma.Decimal(data.apmcDelta) : null,
          }),
          ...(data.isProcurementActive !== undefined && {
            isProcurementActive: data.isProcurementActive,
          }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.metadata !== undefined && { metadata: data.metadata }),
          updatedById: actor.id,
        },
        tx
      );

      await pricingRepository.createAuditLog(tx, {
        actorUserId: actor.id,
        actorRole: effectiveRole,
        action: 'RATE_UPDATED',
        entityType: 'MandiRate',
        entityId: record.id,
        oldValue: formatRateRecord(existing),
        newValue: formatRateRecord(record),
      });

      return record;
    });

    return formatRateRecord(updated);
  }

  async updateRateStatus(id, nextStatus, actor) {
    const existing = await pricingRepository.findRateById(id);
    if (!existing) {
      throw new NotFoundError('Mandi rate record not found.');
    }

    await this.enforceWritePolicy(existing.hubId ?? null, actor);

    const effectiveRole = getEffectiveActorRole(actor);
    const updated = await pricingRepository.runInTransaction(async (tx) => {
      if (nextStatus === 'PUBLISHED') {
        await pricingRepository.archiveConflictingPublishedRates(
          {
            hubId: existing.hubId ?? null,
            cropVarietyId: existing.cropVarietyId,
            gradeCode: existing.gradeCode,
            rateDate: existing.rateDate,
            excludeId: existing.id,
          },
          tx
        );
      }

      const record = await pricingRepository.updateRate(
        id,
        {
          status: nextStatus,
          updatedById: actor.id,
          ...(nextStatus === 'PUBLISHED' && {
            publishedById: actor.id,
            publishedAt: new Date(),
          }),
        },
        tx
      );

      await pricingRepository.createAuditLog(tx, {
        actorUserId: actor.id,
        actorRole: effectiveRole,
        action: `RATE_STATUS_${nextStatus}`,
        entityType: 'MandiRate',
        entityId: record.id,
        oldValue: { status: existing.status },
        newValue: { status: record.status },
      });

      return record;
    });

    return formatRateRecord(updated);
  }

  async bulkUpsertRates(items, actor) {
    const effectiveRole = getEffectiveActorRole(actor);

    for (const item of items) {
      await this.enforceWritePolicy(item.hubId ?? null, actor);
    }

    const varietyIds = Array.from(
      new Set(items.map((item) => item.cropVarietyId).filter(Boolean))
    );
    const hubIds = Array.from(
      new Set(items.map((item) => item.hubId).filter(Boolean))
    );

    const [varieties, hubs] = await Promise.all([
      pricingRepository.findVarietiesByIds(varietyIds),
      pricingRepository.findHubsByIds(hubIds),
    ]);

    const varietyMap = new Map(varieties.map((v) => [v.id, v]));
    const hubMap = new Map(hubs.map((h) => [h.id, h]));

    const preparedItems = items.map((item) => {
      const hubId = item.hubId ?? null;
      const rateDate = toUtcDateOnly(item.effectiveDate);

      const { gradeCode, legacyGrade } = this.validateVarietyAndHubRecords({
        variety: varietyMap.get(item.cropVarietyId) || null,
        hub: hubId ? hubMap.get(hubId) || null : null,
        hubId,
        gradeCode: item.gradeCode,
        unit: item.unit,
      });

      const metrics = computePricingMetrics({
        farmerBuyRate: item.farmerBuyRate,
        consumerSellRate: item.consumerSellRate,
        minRatePerUnit: item.minRatePerUnit,
        maxRatePerUnit: item.maxRatePerUnit,
        bulkTiers: item.bulkTiers,
      });

      return {
        item,
        hubId,
        rateDate,
        gradeCode,
        legacyGrade,
        metrics,
        status: item.status || 'DRAFT',
      };
    });

    const results = await pricingRepository.runInTransaction(
      async (tx) => {
        const processed = [];
        const auditEntries = [];

        for (const entry of preparedItems) {
          const {
            item,
            hubId,
            rateDate,
            gradeCode,
            legacyGrade,
            metrics,
            status,
          } = entry;

          if (status === 'PUBLISHED') {
            await pricingRepository.archiveConflictingPublishedRates(
              {
                hubId,
                cropVarietyId: item.cropVarietyId,
                gradeCode,
                rateDate,
              },
              tx
            );
          }

          const existingDraft =
            status === 'DRAFT'
              ? await pricingRepository.findDraftRateByKey(
                  {
                    hubId,
                    cropVarietyId: item.cropVarietyId,
                    gradeCode,
                    rateDate,
                  },
                  tx
                )
              : null;

          let saved;
          if (existingDraft) {
            saved = await pricingRepository.updateRate(
              existingDraft.id,
              {
                grade: legacyGrade,
                gradeCode,
                ...metrics,
                unit: item.unit,
                trend: item.trend || existingDraft.trend,
                apmcDelta:
                  item.apmcDelta !== undefined && item.apmcDelta !== null
                    ? new Prisma.Decimal(item.apmcDelta)
                    : null,
                isProcurementActive: item.isProcurementActive ?? true,
                notes: item.notes ?? null,
                updatedById: actor.id,
              },
              tx
            );
          } else {
            saved = await pricingRepository.createRate(
              {
                hubId,
                cropVarietyId: item.cropVarietyId,
                grade: legacyGrade,
                gradeCode,
                rateDate,
                ...metrics,
                unit: item.unit,
                trend: item.trend || 'STABLE',
                apmcDelta:
                  item.apmcDelta !== undefined && item.apmcDelta !== null
                    ? new Prisma.Decimal(item.apmcDelta)
                    : null,
                status,
                isProcurementActive: item.isProcurementActive ?? true,
                notes: item.notes ?? null,
                createdById: actor.id,
                updatedById: actor.id,
                publishedById: status === 'PUBLISHED' ? actor.id : null,
                publishedAt: status === 'PUBLISHED' ? new Date() : null,
                metadata: item.metadata ?? null,
              },
              tx
            );
          }

          const formatted = formatRateRecord(saved);
          auditEntries.push({
            actorUserId: actor.id,
            actorRole: effectiveRole,
            action: existingDraft ? 'RATE_BULK_UPDATED' : 'RATE_BULK_CREATED',
            entityType: 'MandiRate',
            entityId: saved.id,
            newValue: formatted,
          });

          processed.push(formatted);
        }

        await pricingRepository.createAuditLogsMany(tx, auditEntries);

        return processed;
      },
      { maxWait: 10000, timeout: 30000 }
    );

    return results;
  }

  async getActiveRate(
    varietyId,
    hubId = null,
    gradeCode = 'GRADE_A',
    asOfDate = new Date()
  ) {
    const normalizedGradeCode = normalizeGradeCode(gradeCode);
    const targetDate = toUtcDateOnly(asOfDate);

    if (hubId) {
      const hubRate = await pricingRepository.findActivePublishedRate({
        varietyId,
        hubId,
        gradeCode: normalizedGradeCode,
        asOfDate: targetDate,
      });
      if (hubRate) {
        return {
          ...formatRateRecord(hubRate),
          source: 'HUB_OVERRIDE',
        };
      }
    }

    const globalRate = await pricingRepository.findActivePublishedRate({
      varietyId,
      hubId: null,
      gradeCode: normalizedGradeCode,
      asOfDate: targetDate,
    });

    if (!globalRate) {
      return null;
    }

    return {
      ...formatRateRecord(globalRate),
      source: 'GLOBAL_BENCHMARK',
    };
  }

  async resolveRateForAdmin(query, actor) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.MANDI_RATE.VIEW,
      resource: 'MANDI_RATE',
      hubId: query.hubId ?? null,
    });

    return this.getActiveRate(
      query.varietyId,
      query.hubId ?? null,
      query.gradeCode || 'GRADE_A',
      query.effectiveDate || new Date()
    );
  }
}

export const pricingService = new PricingService();
