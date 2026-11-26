import { Prisma } from '@prisma/client';
import { prisma } from '../../core/database/prisma.js';

export class CatalogRepository {
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

  async findCategoryById(id, tx = null) {
    return (tx || prisma).category.findUnique({
      where: { id },
      relationLoadStrategy: 'join',
      include: {
        _count: {
          select: { crops: true },
        },
        crops: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            slug: true,
            name: true,
            translations: true,
            baseUnit: true,
            perishabilityType: true,
            isActive: true,
          },
        },
      },
    });
  }

  async findCategoryBySlug(slug, tx = null) {
    return (tx || prisma).category.findUnique({
      where: { slug },
    });
  }

  async createCategory(data, tx = null) {
    return (tx || prisma).category.create({
      data: {
        slug: data.slug,
        name: data.name,
        translations: data.translations,
        icon: data.icon || null,
        imageUrl: data.imageUrl || null,
        displayOrder: data.displayOrder ?? 0,
        isActive: data.isActive ?? true,
        metadata: data.metadata ?? null,
      },
      include: {
        _count: {
          select: { crops: true },
        },
      },
    });
  }

  async updateCategory(id, data, tx = null) {
    return (tx || prisma).category.update({
      where: { id },
      data: {
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.translations !== undefined && { translations: data.translations }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
      },
      include: {
        _count: {
          select: { crops: true },
        },
      },
    });
  }

  async deleteCategory(id, tx = null) {
    return (tx || prisma).category.delete({
      where: { id },
    });
  }

  async listCategories(filters) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const where = {};
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true' || filters.isActive === true;
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { translations: { path: ['hi'], string_contains: q } },
        { translations: { path: ['en'], string_contains: q } },
      ];
    }

    const orderField = ['displayOrder', 'name', 'createdAt'].includes(filters.sortBy)
      ? filters.sortBy
      : 'displayOrder';
    const orderDirection = filters.sortOrder === 'desc' ? 'desc' : 'asc';

    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [orderField]: orderDirection }, { name: 'asc' }],
        relationLoadStrategy: 'join',
        include: {
          _count: {
            select: { crops: true },
          },
        },
      }),
      prisma.category.count({ where }),
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

  async findCropById(id, tx = null) {
    return (tx || prisma).crop.findUnique({
      where: { id },
      relationLoadStrategy: 'join',
      include: {
        category: {
          select: {
            id: true,
            slug: true,
            name: true,
            translations: true,
            isActive: true,
          },
        },
        _count: {
          select: { varieties: true },
        },
        varieties: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            slug: true,
            name: true,
            translations: true,
            unitConversions: true,
            gradeSpecs: true,
            imageUrl: true,
            isActive: true,
          },
        },
      },
    });
  }

  async findCropBySlug(slug, tx = null) {
    return (tx || prisma).crop.findUnique({
      where: { slug },
    });
  }

  async createCrop(data, tx = null) {
    return (tx || prisma).crop.create({
      data: {
        categoryId: data.categoryId,
        slug: data.slug,
        name: data.name,
        translations: data.translations,
        botanicalName: data.botanicalName || null,
        perishabilityType: data.perishabilityType || 'NON_PERISHABLE',
        shelfLifeDays: data.shelfLifeDays ?? null,
        baseUnit: data.baseUnit || 'KG',
        unitConversions: data.unitConversions ?? null,
        standardMoistureThreshold: data.standardMoistureThreshold ?? null,
        imageUrl: data.imageUrl || null,
        isActive: data.isActive ?? true,
        metadata: data.metadata ?? null,
      },
      include: {
        category: {
          select: {
            id: true,
            slug: true,
            name: true,
            translations: true,
          },
        },
        _count: {
          select: { varieties: true },
        },
      },
    });
  }

  async updateCrop(id, data, tx = null) {
    return (tx || prisma).crop.update({
      where: { id },
      data: {
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.translations !== undefined && { translations: data.translations }),
        ...(data.botanicalName !== undefined && { botanicalName: data.botanicalName }),
        ...(data.perishabilityType !== undefined && { perishabilityType: data.perishabilityType }),
        ...(data.shelfLifeDays !== undefined && { shelfLifeDays: data.shelfLifeDays }),
        ...(data.baseUnit !== undefined && { baseUnit: data.baseUnit }),
        ...(data.unitConversions !== undefined && { unitConversions: data.unitConversions }),
        ...(data.standardMoistureThreshold !== undefined && {
          standardMoistureThreshold: data.standardMoistureThreshold,
        }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
      },
      include: {
        category: {
          select: {
            id: true,
            slug: true,
            name: true,
            translations: true,
          },
        },
        _count: {
          select: { varieties: true },
        },
      },
    });
  }

  async deleteCrop(id, tx = null) {
    return (tx || prisma).crop.delete({
      where: { id },
    });
  }

  async listCrops(filters) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const where = {};
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters.baseUnit) {
      where.baseUnit = filters.baseUnit;
    }
    if (filters.perishabilityType) {
      where.perishabilityType = filters.perishabilityType;
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true' || filters.isActive === true;
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { botanicalName: { contains: q, mode: 'insensitive' } },
        { translations: { path: ['hi'], string_contains: q } },
        { translations: { path: ['en'], string_contains: q } },
      ];
    }

    const orderField = ['name', 'baseUnit', 'perishabilityType', 'createdAt'].includes(
      filters.sortBy
    )
      ? filters.sortBy
      : 'name';
    const orderDirection = filters.sortOrder === 'desc' ? 'desc' : 'asc';

    const [items, total] = await Promise.all([
      prisma.crop.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        relationLoadStrategy: 'join',
        include: {
          category: {
            select: {
              id: true,
              slug: true,
              name: true,
              translations: true,
            },
          },
          _count: {
            select: { varieties: true },
          },
        },
      }),
      prisma.crop.count({ where }),
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

  async findVarietyById(id, tx = null) {
    return (tx || prisma).cropVariety.findUnique({
      where: { id },
      relationLoadStrategy: 'join',
      include: {
        crop: {
          include: {
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
        _count: {
          select: {
            mandiRates: true,
            produceListings: true,
            supplyTokens: true,
            goodsReceiptNotes: true,
            hubInventories: true,
            orderItems: true,
            preBookBatches: true,
            cartItems: true,
          },
        },
      },
    });
  }

  async findVarietyBySlug(slug, tx = null) {
    return (tx || prisma).cropVariety.findUnique({
      where: { slug },
    });
  }

  async createVariety(data, tx = null) {
    return (tx || prisma).cropVariety.create({
      data: {
        cropId: data.cropId,
        slug: data.slug,
        name: data.name,
        translations: data.translations,
        unitConversions: data.unitConversions ?? null,
        gradeSpecs: data.gradeSpecs ?? null,
        imageUrl: data.imageUrl || null,
        isActive: data.isActive ?? true,
        metadata: data.metadata ?? null,
      },
      include: {
        crop: {
          include: {
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
    });
  }

  async updateVariety(id, data, tx = null) {
    return (tx || prisma).cropVariety.update({
      where: { id },
      data: {
        ...(data.cropId !== undefined && { cropId: data.cropId }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.translations !== undefined && { translations: data.translations }),
        ...(data.unitConversions !== undefined && { unitConversions: data.unitConversions }),
        ...(data.gradeSpecs !== undefined && { gradeSpecs: data.gradeSpecs }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
      },
      include: {
        crop: {
          include: {
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
    });
  }

  async deleteVariety(id, tx = null) {
    return (tx || prisma).cropVariety.delete({
      where: { id },
    });
  }

  async findVarietyIdsByGradeCode(gradeCode) {
    const normalized = String(gradeCode)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!normalized) {
      return [];
    }

    const rows = await prisma.$queryRaw`
      SELECT id
      FROM "CropVariety"
      WHERE "gradeSpecs" IS NOT NULL
        AND (
          (
            jsonb_typeof("gradeSpecs"::jsonb) = 'array'
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements("gradeSpecs"::jsonb) AS elem
              WHERE UPPER(COALESCE(elem->>'code', '')) = ${normalized}
            )
          )
          OR (
            jsonb_typeof("gradeSpecs"::jsonb) = 'object'
            AND EXISTS (
              SELECT 1
              FROM jsonb_object_keys("gradeSpecs"::jsonb) AS k
              WHERE UPPER(k) = ${normalized}
            )
          )
        )
    `;
    return rows.map((row) => row.id);
  }

  async findVarietyIdsMatchingGradeSpecsText(searchText) {
    const q = String(searchText || '').trim();
    if (!q) {
      return [];
    }

    const pattern = `%${q}%`;
    const rows = await prisma.$queryRaw`
      SELECT id
      FROM "CropVariety"
      WHERE "gradeSpecs" IS NOT NULL
        AND "gradeSpecs"::text ILIKE ${pattern}
    `;
    return rows.map((row) => row.id);
  }

  async listVarieties(filters) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const where = {};
    if (filters.cropId) {
      where.cropId = filters.cropId;
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true' || filters.isActive === true;
    }

    const cropWhere = {};
    if (filters.categoryId) {
      cropWhere.categoryId = filters.categoryId;
    }
    if (filters.baseUnit) {
      cropWhere.baseUnit = filters.baseUnit;
    }
    if (filters.perishabilityType) {
      cropWhere.perishabilityType = filters.perishabilityType;
    }
    if (Object.keys(cropWhere).length > 0) {
      where.crop = cropWhere;
    }

    const [matchingIds, gradeMatchIds] = await Promise.all([
      filters.grade
        ? this.findVarietyIdsByGradeCode(filters.grade)
        : Promise.resolve(null),
      filters.search
        ? this.findVarietyIdsMatchingGradeSpecsText(filters.search.trim())
        : Promise.resolve([]),
    ]);

    if (matchingIds !== null) {
      where.id = { in: matchingIds };
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { translations: { path: ['hi'], string_contains: q } },
        { translations: { path: ['en'], string_contains: q } },
        { crop: { name: { contains: q, mode: 'insensitive' } } },
        { crop: { translations: { path: ['hi'], string_contains: q } } },
        ...(gradeMatchIds.length > 0 ? [{ id: { in: gradeMatchIds } }] : []),
      ];
    }

    const orderField = ['name', 'createdAt'].includes(filters.sortBy)
      ? filters.sortBy
      : 'name';
    const orderDirection = filters.sortOrder === 'desc' ? 'desc' : 'asc';

    const [items, total] = await Promise.all([
      prisma.cropVariety.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderField]: orderDirection },
        relationLoadStrategy: 'join',
        include: {
          crop: {
            include: {
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
      }),
      prisma.cropVariety.count({ where }),
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

export const catalogRepository = new CatalogRepository();
