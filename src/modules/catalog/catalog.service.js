import { Prisma } from '@prisma/client';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../core/errors/app.error.js';
import { ACTIONS } from '../../core/rbac/actions.js';
import { globalPolicyGuard } from '../../core/rbac/policy.guard.js';
import { catalogRepository } from './catalog.repository.js';

const BASE_UNITS = ['KG', 'PIECE'];
const TRADE_UNITS = ['KG', 'QUINTAL', 'CRATE', 'BAG', 'PIECE', 'DOZEN'];
const PERISHABILITY_TYPES = ['PERISHABLE', 'NON_PERISHABLE'];
const QUALITY_GRADES = ['GRADE_A', 'GRADE_B', 'GRADE_C', 'EXPORT', 'ORGANIC'];

const DEFAULT_GRADE_PRESETS = [
  {
    code: 'GRADE_A',
    label: 'Grade A (Premium)',
    labelHi: 'ग्रेड A (प्रीमियम)',
  },
  {
    code: 'GRADE_B',
    label: 'Grade B (Standard)',
    labelHi: 'ग्रेड B (मानक)',
  },
  {
    code: 'FAQ',
    label: 'FAQ (Fair Average Quality)',
    labelHi: 'एफएक्यू (औसत अच्छी गुणवत्ता)',
  },
];

const DEFAULT_UNIT_CONVERSION_PRESETS = {
  KG: { QUINTAL: 100, BAG: 50, CRATE: 20 },
  PIECE: { DOZEN: 12, CRATE: 120 },
};

function buildSlug(raw) {
  const slug = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    throw new BadRequestError('A valid English name or slug is required to generate slug.');
  }

  return slug;
}

function getEffectiveActorRole(actor) {
  if (!actor) return null;
  if (actor.activeRole) return actor.activeRole;
  const roles = Array.isArray(actor.roles) ? actor.roles : [];
  if (roles.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (roles.includes('ADMIN')) return 'ADMIN';
  return roles[0] || null;
}

function normalizeUnitConversions(unitConversions, baseUnit) {
  if (unitConversions === undefined) return undefined;
  if (unitConversions === null) return null;

  const normalized = {};
  for (const [unit, factor] of Object.entries(unitConversions)) {
    if (!TRADE_UNITS.includes(unit)) {
      throw new BadRequestError(`Unsupported quantity unit: ${unit}`);
    }
    const numericFactor = Number(factor);
    if (!Number.isFinite(numericFactor) || numericFactor <= 0) {
      throw new BadRequestError(`Conversion factor for ${unit} must be greater than 0.`);
    }
    if (unit === baseUnit) {
      if (numericFactor !== 1) {
        throw new BadRequestError(
          `Base unit ${baseUnit} cannot have a conversion factor other than 1.`
        );
      }
      continue;
    }
    normalized[unit] = numericFactor;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizeGradeSpecs(gradeSpecs) {
  if (gradeSpecs === undefined) return undefined;
  if (gradeSpecs === null) return null;

  const seenCodes = new Set();
  const normalized = [];

  for (const item of gradeSpecs) {
    const code = String(item.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!code) {
      throw new BadRequestError('Every grade specification requires a valid code.');
    }

    if (seenCodes.has(code)) {
      throw new BadRequestError(`Duplicate grade code "${code}" is not allowed.`);
    }
    seenCodes.add(code);

    normalized.push({
      code,
      label: item.label.trim(),
      labelHi: (item.labelHi || '').trim(),
      maxMoisturePercent:
        item.maxMoisturePercent !== undefined && item.maxMoisturePercent !== null
          ? Number(item.maxMoisturePercent)
          : null,
      maxForeignMatterPercent:
        item.maxForeignMatterPercent !== undefined && item.maxForeignMatterPercent !== null
          ? Number(item.maxForeignMatterPercent)
          : null,
      notes: (item.notes || '').trim(),
    });
  }

  return normalized.length > 0 ? normalized : null;
}

export class CatalogService {
  resolveEffectiveUnitConversions(crop, variety = null) {
    const baseUnit = crop?.baseUnit || 'KG';
    return {
      [baseUnit]: 1,
      ...(crop?.unitConversions && typeof crop.unitConversions === 'object'
        ? crop.unitConversions
        : {}),
      ...(variety?.unitConversions && typeof variety.unitConversions === 'object'
        ? variety.unitConversions
        : {}),
    };
  }

  convertToBaseUnit({ crop, variety = null, unit, quantity }) {
    const conversions = this.resolveEffectiveUnitConversions(crop, variety);
    const factor = conversions[unit];
    if (!factor) {
      throw new BadRequestError(
        `Unit ${unit} has no conversion defined to base unit ${crop.baseUnit}.`
      );
    }
    return new Prisma.Decimal(String(quantity)).mul(new Prisma.Decimal(String(factor)));
  }

  enrichVariety(variety) {
    if (!variety) return variety;
    return {
      ...variety,
      effectiveUnitConversions: this.resolveEffectiveUnitConversions(variety.crop, variety),
    };
  }

  async getMetadata(actor) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.VIEW,
      resource: 'CROP',
    });

    return {
      baseUnits: BASE_UNITS,
      tradeUnits: TRADE_UNITS,
      perishabilityTypes: PERISHABILITY_TYPES,
      qualityGrades: QUALITY_GRADES,
      defaultGradePresets: DEFAULT_GRADE_PRESETS,
      defaultUnitConversionPresets: DEFAULT_UNIT_CONVERSION_PRESETS,
    };
  }

  async listCategories(filters, actor) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.VIEW,
      resource: 'CROP',
    });

    return catalogRepository.listCategories(filters);
  }

  async getCategoryById(id, actor) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.VIEW,
      resource: 'CROP',
    });

    const category = await catalogRepository.findCategoryById(id);
    if (!category) {
      throw new NotFoundError('Category not found.');
    }
    return category;
  }

  async createCategory(data, actor, requestId = null) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.CREATE,
      resource: 'CROP',
    });

    const resolvedName = (data.name || data.translations.en).trim();
    const resolvedSlug = data.slug ? buildSlug(data.slug) : buildSlug(data.translations.en || resolvedName);

    return catalogRepository.runInTransaction(async (tx) => {
      const existing = await catalogRepository.findCategoryBySlug(resolvedSlug, tx);
      if (existing) {
        throw new ConflictError(`A category with slug "${resolvedSlug}" already exists.`);
      }

      const created = await catalogRepository.createCategory(
        {
          ...data,
          name: resolvedName,
          slug: resolvedSlug,
          imageUrl: data.imageUrl || null,
        },
        tx
      );

      await catalogRepository.createAuditLog(tx, {
        actorUserId: actor.id,
        actorRole: getEffectiveActorRole(actor),
        action: ACTIONS.CROP.CREATE,
        entityType: 'Category',
        entityId: created.id,
        oldValue: null,
        newValue: created,
        metadata: { requestId },
      });

      return created;
    });
  }

  async updateCategory(id, data, actor, requestId = null) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.UPDATE,
      resource: 'CROP',
    });

    return catalogRepository.runInTransaction(async (tx) => {
      const existing = await catalogRepository.findCategoryById(id, tx);
      if (!existing) {
        throw new NotFoundError('Category not found.');
      }

      let nextSlug = data.slug !== undefined ? buildSlug(data.slug) : undefined;
      if (nextSlug && nextSlug !== existing.slug) {
        const conflict = await catalogRepository.findCategoryBySlug(nextSlug, tx);
        if (conflict) {
          throw new ConflictError(`A category with slug "${nextSlug}" already exists.`);
        }
      }

      const nextName =
        data.name !== undefined
          ? data.name.trim()
          : data.translations?.en
            ? data.translations.en.trim()
            : undefined;

      const updated = await catalogRepository.updateCategory(
        id,
        {
          ...data,
          ...(nextSlug !== undefined && { slug: nextSlug }),
          ...(nextName !== undefined && { name: nextName }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
        },
        tx
      );

      await catalogRepository.createAuditLog(tx, {
        actorUserId: actor.id,
        actorRole: getEffectiveActorRole(actor),
        action: ACTIONS.CROP.UPDATE,
        entityType: 'Category',
        entityId: id,
        oldValue: existing,
        newValue: updated,
        metadata: { requestId },
      });

      return updated;
    });
  }

  async deleteCategory(id, actor, requestId = null) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.DELETE,
      resource: 'CROP',
    });

    return catalogRepository.runInTransaction(async (tx) => {
      const existing = await catalogRepository.findCategoryById(id, tx);
      if (!existing) {
        throw new NotFoundError('Category not found.');
      }

      if ((existing._count?.crops || 0) > 0) {
        throw new ConflictError(
          'Cannot delete a category that still has crops. Deactivate it or reassign crops first.'
        );
      }

      await catalogRepository.deleteCategory(id, tx);

      await catalogRepository.createAuditLog(tx, {
        actorUserId: actor.id,
        actorRole: getEffectiveActorRole(actor),
        action: ACTIONS.CROP.DELETE,
        entityType: 'Category',
        entityId: id,
        oldValue: existing,
        newValue: null,
        metadata: { requestId },
      });

      return { message: 'Category deleted successfully.' };
    });
  }

  async listCrops(filters, actor) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.VIEW,
      resource: 'CROP',
    });

    return catalogRepository.listCrops(filters);
  }

  async getCropById(id, actor) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.VIEW,
      resource: 'CROP',
    });

    const crop = await catalogRepository.findCropById(id);
    if (!crop) {
      throw new NotFoundError('Crop not found.');
    }

    return {
      ...crop,
      effectiveUnitConversions: this.resolveEffectiveUnitConversions(crop),
      varieties: (crop.varieties || []).map((v) => ({
        ...v,
        effectiveUnitConversions: this.resolveEffectiveUnitConversions(crop, v),
      })),
    };
  }

  async createCrop(data, actor, requestId = null) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.CREATE,
      resource: 'CROP',
    });

    const resolvedName = (data.name || data.translations.en).trim();
    const resolvedSlug = data.slug ? buildSlug(data.slug) : buildSlug(data.translations.en || resolvedName);
    const normalizedConversions = normalizeUnitConversions(data.unitConversions, data.baseUnit || 'KG');

    return catalogRepository.runInTransaction(async (tx) => {
      const category = await catalogRepository.findCategoryById(data.categoryId, tx);
      if (!category) {
        throw new NotFoundError('Parent category not found.');
      }

      const existing = await catalogRepository.findCropBySlug(resolvedSlug, tx);
      if (existing) {
        throw new ConflictError(`A crop with slug "${resolvedSlug}" already exists.`);
      }

      const created = await catalogRepository.createCrop(
        {
          ...data,
          name: resolvedName,
          slug: resolvedSlug,
          unitConversions: normalizedConversions,
          imageUrl: data.imageUrl || null,
        },
        tx
      );

      await catalogRepository.createAuditLog(tx, {
        actorUserId: actor.id,
        actorRole: getEffectiveActorRole(actor),
        action: ACTIONS.CROP.CREATE,
        entityType: 'Crop',
        entityId: created.id,
        oldValue: null,
        newValue: created,
        metadata: { requestId },
      });

      return {
        ...created,
        effectiveUnitConversions: this.resolveEffectiveUnitConversions(created),
      };
    });
  }

  async updateCrop(id, data, actor, requestId = null) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.UPDATE,
      resource: 'CROP',
    });

    return catalogRepository.runInTransaction(async (tx) => {
      const existing = await catalogRepository.findCropById(id, tx);
      if (!existing) {
        throw new NotFoundError('Crop not found.');
      }

      if (data.categoryId !== undefined && data.categoryId !== existing.categoryId) {
        const category = await catalogRepository.findCategoryById(data.categoryId, tx);
        if (!category) {
          throw new NotFoundError('Target parent category not found.');
        }
      }

      if (
        data.baseUnit !== undefined &&
        data.baseUnit !== existing.baseUnit &&
        (existing._count?.varieties || 0) > 0
      ) {
        throw new ConflictError(
          'Cannot change canonical baseUnit after crop varieties have been created.'
        );
      }

      const nextSlug = data.slug !== undefined ? buildSlug(data.slug) : undefined;
      if (nextSlug && nextSlug !== existing.slug) {
        const conflict = await catalogRepository.findCropBySlug(nextSlug, tx);
        if (conflict) {
          throw new ConflictError(`A crop with slug "${nextSlug}" already exists.`);
        }
      }

      const effectiveBaseUnit = data.baseUnit || existing.baseUnit;
      const normalizedConversions =
        data.unitConversions !== undefined
          ? normalizeUnitConversions(data.unitConversions, effectiveBaseUnit)
          : undefined;

      const nextName =
        data.name !== undefined
          ? data.name.trim()
          : data.translations?.en
            ? data.translations.en.trim()
            : undefined;

      const updated = await catalogRepository.updateCrop(
        id,
        {
          ...data,
          ...(nextSlug !== undefined && { slug: nextSlug }),
          ...(nextName !== undefined && { name: nextName }),
          ...(normalizedConversions !== undefined && { unitConversions: normalizedConversions }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
        },
        tx
      );

      await catalogRepository.createAuditLog(tx, {
        actorUserId: actor.id,
        actorRole: getEffectiveActorRole(actor),
        action: ACTIONS.CROP.UPDATE,
        entityType: 'Crop',
        entityId: id,
        oldValue: existing,
        newValue: updated,
        metadata: { requestId },
      });

      return {
        ...updated,
        effectiveUnitConversions: this.resolveEffectiveUnitConversions(updated),
      };
    });
  }

  async deleteCrop(id, actor, requestId = null) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.DELETE,
      resource: 'CROP',
    });

    return catalogRepository.runInTransaction(async (tx) => {
      const existing = await catalogRepository.findCropById(id, tx);
      if (!existing) {
        throw new NotFoundError('Crop not found.');
      }

      if ((existing._count?.varieties || 0) > 0) {
        throw new ConflictError(
          'Cannot delete a crop that has varieties. Deactivate it or delete varieties first.'
        );
      }

      await catalogRepository.deleteCrop(id, tx);

      await catalogRepository.createAuditLog(tx, {
        actorUserId: actor.id,
        actorRole: getEffectiveActorRole(actor),
        action: ACTIONS.CROP.DELETE,
        entityType: 'Crop',
        entityId: id,
        oldValue: existing,
        newValue: null,
        metadata: { requestId },
      });

      return { message: 'Crop deleted successfully.' };
    });
  }

  async listVarieties(filters, actor) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.VIEW,
      resource: 'CROP',
    });

    const result = await catalogRepository.listVarieties(filters);
    return {
      items: result.items.map((item) => this.enrichVariety(item)),
      meta: result.meta,
    };
  }

  async getVarietyById(id, actor) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.VIEW,
      resource: 'CROP',
    });

    const variety = await catalogRepository.findVarietyById(id);
    if (!variety) {
      throw new NotFoundError('Crop variety not found.');
    }

    return this.enrichVariety(variety);
  }

  async createVariety(data, actor, requestId = null) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.CREATE,
      resource: 'CROP',
    });

    const resolvedName = (data.name || data.translations.en).trim();
    const resolvedSlug = data.slug ? buildSlug(data.slug) : buildSlug(data.translations.en || resolvedName);

    return catalogRepository.runInTransaction(async (tx) => {
      const crop = await catalogRepository.findCropById(data.cropId, tx);
      if (!crop) {
        throw new NotFoundError('Parent crop not found.');
      }

      const existing = await catalogRepository.findVarietyBySlug(resolvedSlug, tx);
      if (existing) {
        throw new ConflictError(`A crop variety with slug "${resolvedSlug}" already exists.`);
      }

      const normalizedConversions = normalizeUnitConversions(data.unitConversions, crop.baseUnit);
      const normalizedGrades = normalizeGradeSpecs(data.gradeSpecs);

      const created = await catalogRepository.createVariety(
        {
          ...data,
          name: resolvedName,
          slug: resolvedSlug,
          unitConversions: normalizedConversions,
          gradeSpecs: normalizedGrades,
          imageUrl: data.imageUrl || null,
        },
        tx
      );

      await catalogRepository.createAuditLog(tx, {
        actorUserId: actor.id,
        actorRole: getEffectiveActorRole(actor),
        action: ACTIONS.CROP.CREATE,
        entityType: 'CropVariety',
        entityId: created.id,
        oldValue: null,
        newValue: created,
        metadata: { requestId },
      });

      return this.enrichVariety(created);
    });
  }

  async updateVariety(id, data, actor, requestId = null) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.UPDATE,
      resource: 'CROP',
    });

    return catalogRepository.runInTransaction(async (tx) => {
      const existing = await catalogRepository.findVarietyById(id, tx);
      if (!existing) {
        throw new NotFoundError('Crop variety not found.');
      }

      let targetCrop = existing.crop;
      if (data.cropId !== undefined && data.cropId !== existing.cropId) {
        const nextCrop = await catalogRepository.findCropById(data.cropId, tx);
        if (!nextCrop) {
          throw new NotFoundError('Target parent crop not found.');
        }
        targetCrop = nextCrop;
      }

      const nextSlug = data.slug !== undefined ? buildSlug(data.slug) : undefined;
      if (nextSlug && nextSlug !== existing.slug) {
        const conflict = await catalogRepository.findVarietyBySlug(nextSlug, tx);
        if (conflict) {
          throw new ConflictError(`A crop variety with slug "${nextSlug}" already exists.`);
        }
      }

      const normalizedConversions =
        data.unitConversions !== undefined
          ? normalizeUnitConversions(data.unitConversions, targetCrop.baseUnit)
          : undefined;
      const normalizedGrades =
        data.gradeSpecs !== undefined ? normalizeGradeSpecs(data.gradeSpecs) : undefined;

      const nextName =
        data.name !== undefined
          ? data.name.trim()
          : data.translations?.en
            ? data.translations.en.trim()
            : undefined;

      const updated = await catalogRepository.updateVariety(
        id,
        {
          ...data,
          ...(nextSlug !== undefined && { slug: nextSlug }),
          ...(nextName !== undefined && { name: nextName }),
          ...(normalizedConversions !== undefined && { unitConversions: normalizedConversions }),
          ...(normalizedGrades !== undefined && { gradeSpecs: normalizedGrades }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
        },
        tx
      );

      await catalogRepository.createAuditLog(tx, {
        actorUserId: actor.id,
        actorRole: getEffectiveActorRole(actor),
        action: ACTIONS.CROP.UPDATE,
        entityType: 'CropVariety',
        entityId: id,
        oldValue: existing,
        newValue: updated,
        metadata: { requestId },
      });

      return this.enrichVariety(updated);
    });
  }

  async deleteVariety(id, actor, requestId = null) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: ACTIONS.CROP.DELETE,
      resource: 'CROP',
    });

    return catalogRepository.runInTransaction(async (tx) => {
      const existing = await catalogRepository.findVarietyById(id, tx);
      if (!existing) {
        throw new NotFoundError('Crop variety not found.');
      }

      const counts = existing._count || {};
      const totalReferences =
        (counts.mandiRates || 0) +
        (counts.produceListings || 0) +
        (counts.supplyTokens || 0) +
        (counts.goodsReceiptNotes || 0) +
        (counts.hubInventories || 0) +
        (counts.orderItems || 0) +
        (counts.preBookBatches || 0) +
        (counts.cartItems || 0);

      if (totalReferences > 0) {
        throw new ConflictError(
          'Cannot delete a variety referenced by rates, inventory, listings, GRNs, or orders. Deactivate it instead.'
        );
      }

      await catalogRepository.deleteVariety(id, tx);

      await catalogRepository.createAuditLog(tx, {
        actorUserId: actor.id,
        actorRole: getEffectiveActorRole(actor),
        action: ACTIONS.CROP.DELETE,
        entityType: 'CropVariety',
        entityId: id,
        oldValue: existing,
        newValue: null,
        metadata: { requestId },
      });

      return { message: 'Crop variety deleted successfully.' };
    });
  }

  async listPublicCategories(filters = {}) {
    return catalogRepository.listCategories({ ...filters, isActive: true });
  }

  async listPublicCrops(filters = {}) {
    return catalogRepository.listCrops({ ...filters, isActive: true });
  }

  async listPublicVarieties(filters = {}) {
    const result = await catalogRepository.listVarieties({ ...filters, isActive: true });
    return {
      items: result.items.map((item) => this.enrichVariety(item)),
      meta: result.meta,
    };
  }
}

export const catalogService = new CatalogService();
