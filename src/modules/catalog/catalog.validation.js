import { z } from 'zod';

const BASE_UNITS = ['KG', 'PIECE'];
const TRADE_UNITS = ['KG', 'QUINTAL', 'CRATE', 'BAG', 'PIECE', 'DOZEN'];
const PERISHABILITY_TYPES = ['PERISHABLE', 'NON_PERISHABLE'];

const translationsSchema = z.object({
  en: z.string().trim().min(1, 'English name is required').max(150),
  hi: z.string().trim().min(1, 'Hindi name is required').max(150),
});

const optionalSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain lowercase letters, numbers, and hyphens only')
  .max(120)
  .optional();

const unitConversionsSchema = z
  .record(z.enum(TRADE_UNITS), z.coerce.number().positive('Conversion multiplier must be greater than 0'))
  .nullable()
  .optional();

const gradeSpecItemSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Grade code is required')
    .max(40)
    .transform((val) =>
      val
        .toUpperCase()
        .replace(/[^A-Z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
    )
    .refine((val) => val.length > 0, 'Grade code must include alphanumeric characters'),
  label: z.string().trim().min(1, 'Grade label is required').max(100),
  labelHi: z.string().trim().max(100).optional().default(''),
  maxMoisturePercent: z.coerce.number().min(0).max(100).nullable().optional(),
  maxForeignMatterPercent: z.coerce.number().min(0).max(100).nullable().optional(),
  notes: z.string().trim().max(500).optional().default(''),
});

const gradeSpecsSchema = z.array(gradeSpecItemSchema).nullable().optional();

export const catalogIdParamsSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

export const listCategoriesSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    sortBy: z.enum(['displayOrder', 'name', 'createdAt']).default('displayOrder'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),
};

export const createCategorySchema = {
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: optionalSlugSchema,
    translations: translationsSchema,
    icon: z.string().trim().max(80).nullable().optional(),
    imageUrl: z.string().trim().url().nullable().optional().or(z.literal('')),
    displayOrder: z.coerce.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
};

export const updateCategorySchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: optionalSlugSchema,
    translations: translationsSchema.optional(),
    icon: z.string().trim().max(80).nullable().optional(),
    imageUrl: z.string().trim().url().nullable().optional().or(z.literal('')),
    displayOrder: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
};

export const listCropsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    categoryId: z.string().uuid().optional(),
    baseUnit: z.enum(BASE_UNITS).optional(),
    perishabilityType: z.enum(PERISHABILITY_TYPES).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    sortBy: z.enum(['name', 'baseUnit', 'perishabilityType', 'createdAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),
};

export const createCropSchema = {
  body: z.object({
    categoryId: z.string().uuid(),
    name: z.string().trim().min(2).max(150).optional(),
    slug: optionalSlugSchema,
    translations: translationsSchema,
    botanicalName: z.string().trim().max(150).nullable().optional(),
    perishabilityType: z.enum(PERISHABILITY_TYPES).default('NON_PERISHABLE'),
    shelfLifeDays: z.coerce.number().int().positive().max(3650).nullable().optional(),
    baseUnit: z.enum(BASE_UNITS).default('KG'),
    unitConversions: unitConversionsSchema,
    standardMoistureThreshold: z.coerce.number().min(0).max(100).nullable().optional(),
    imageUrl: z.string().trim().url().nullable().optional().or(z.literal('')),
    isActive: z.boolean().default(true),
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
};

export const updateCropSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    categoryId: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(150).optional(),
    slug: optionalSlugSchema,
    translations: translationsSchema.optional(),
    botanicalName: z.string().trim().max(150).nullable().optional(),
    perishabilityType: z.enum(PERISHABILITY_TYPES).optional(),
    shelfLifeDays: z.coerce.number().int().positive().max(3650).nullable().optional(),
    baseUnit: z.enum(BASE_UNITS).optional(),
    unitConversions: unitConversionsSchema,
    standardMoistureThreshold: z.coerce.number().min(0).max(100).nullable().optional(),
    imageUrl: z.string().trim().url().nullable().optional().or(z.literal('')),
    isActive: z.boolean().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
};

export const listVarietiesSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    categoryId: z.string().uuid().optional(),
    cropId: z.string().uuid().optional(),
    baseUnit: z.enum(BASE_UNITS).optional(),
    perishabilityType: z.enum(PERISHABILITY_TYPES).optional(),
    grade: z.string().trim().max(40).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    sortBy: z.enum(['name', 'createdAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),
};

export const createVarietySchema = {
  body: z.object({
    cropId: z.string().uuid(),
    name: z.string().trim().min(2).max(150).optional(),
    slug: optionalSlugSchema,
    translations: translationsSchema,
    unitConversions: unitConversionsSchema,
    gradeSpecs: gradeSpecsSchema,
    imageUrl: z.string().trim().url().nullable().optional().or(z.literal('')),
    isActive: z.boolean().default(true),
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
};

export const updateVarietySchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    cropId: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(150).optional(),
    slug: optionalSlugSchema,
    translations: translationsSchema.optional(),
    unitConversions: unitConversionsSchema,
    gradeSpecs: gradeSpecsSchema,
    imageUrl: z.string().trim().url().nullable().optional().or(z.literal('')),
    isActive: z.boolean().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
};
