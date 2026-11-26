import { z } from 'zod';

export const QUANTITY_UNITS = ['KG', 'QUINTAL', 'CRATE', 'BAG', 'PIECE', 'DOZEN'];
export const RATE_TRENDS = ['UP', 'DOWN', 'STABLE'];
export const RATE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
export const LEGACY_QUALITY_GRADES = ['GRADE_A', 'GRADE_B', 'GRADE_C', 'EXPORT', 'ORGANIC'];

const dateStringRegex = /^\d{4}-\d{2}-\d{2}$/;

const gradeCodeSchema = z
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
  .refine((val) => val.length > 0, 'Grade code must include alphanumeric characters');

const bulkTierSchema = z.object({
  minQty: z.coerce.number().positive('Tier minimum quantity must be greater than 0'),
  unitPrice: z.coerce.number().positive('Tier unit price must be greater than 0'),
  label: z.string().trim().max(80).optional().default(''),
});

const ratePayloadBase = z.object({
  hubId: z
    .union([z.string().uuid(), z.literal(''), z.null()])
    .optional()
    .transform((val) => (!val ? null : val)),
  cropVarietyId: z.string().uuid('Valid crop variety is required'),
  gradeCode: gradeCodeSchema.default('GRADE_A'),
  effectiveDate: z
    .string()
    .trim()
    .regex(dateStringRegex, 'Effective date must follow YYYY-MM-DD format'),
  unit: z.enum(QUANTITY_UNITS),
  farmerBuyRate: z.coerce
    .number()
    .positive('Farmer buy rate must be greater than 0'),
  consumerSellRate: z.coerce
    .number()
    .positive('Consumer sell rate must be greater than 0'),
  minRatePerUnit: z.coerce.number().positive().nullable().optional(),
  maxRatePerUnit: z.coerce.number().positive().nullable().optional(),
  trend: z.enum(RATE_TRENDS).default('STABLE'),
  apmcDelta: z.coerce.number().nullable().optional(),
  bulkTiers: z.array(bulkTierSchema).max(10).nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  isProcurementActive: z.boolean().default(true),
  notes: z.string().trim().max(500).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const rateIdParamsSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

export const listRatesSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    hubId: z.string().uuid().optional(),
    scope: z.enum(['all', 'global', 'hub']).default('all'),
    categoryId: z.string().uuid().optional(),
    cropId: z.string().uuid().optional(),
    varietyId: z.string().uuid().optional(),
    gradeCode: z.string().trim().max(40).optional(),
    status: z.enum(RATE_STATUSES).optional(),
    effectiveDate: z.string().trim().regex(dateStringRegex).optional(),
    sortBy: z
      .enum(['rateDate', 'farmerBuyRate', 'consumerSellRate', 'marginPercent', 'createdAt'])
      .default('rateDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};

export const resolveRateSchema = {
  query: z.object({
    varietyId: z.string().uuid(),
    hubId: z.string().uuid().optional(),
    gradeCode: gradeCodeSchema.default('GRADE_A'),
    effectiveDate: z.string().trim().regex(dateStringRegex).optional(),
  }),
};

export const createRateSchema = {
  body: ratePayloadBase,
};

export const updateRateSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    gradeCode: gradeCodeSchema.optional(),
    effectiveDate: z
      .string()
      .trim()
      .regex(dateStringRegex, 'Effective date must follow YYYY-MM-DD format')
      .optional(),
    unit: z.enum(QUANTITY_UNITS).optional(),
    farmerBuyRate: z.coerce
      .number()
      .positive('Farmer buy rate must be greater than 0')
      .optional(),
    consumerSellRate: z.coerce
      .number()
      .positive('Consumer sell rate must be greater than 0')
      .optional(),
    minRatePerUnit: z.coerce.number().positive().nullable().optional(),
    maxRatePerUnit: z.coerce.number().positive().nullable().optional(),
    trend: z.enum(RATE_TRENDS).optional(),
    apmcDelta: z.coerce.number().nullable().optional(),
    bulkTiers: z.array(bulkTierSchema).max(10).nullable().optional(),
    isProcurementActive: z.boolean().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
};

export const updateRateStatusSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(RATE_STATUSES),
  }),
};

export const bulkUpsertRatesSchema = {
  body: z.object({
    items: z.array(ratePayloadBase).min(1).max(50),
  }),
};
