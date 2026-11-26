import { z } from 'zod';

const operatingHoursStructuredSchema = z.object({
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  days: z
    .array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']))
    .min(1),
});

const operatingHoursSchema = z
  .union([z.string().trim(), operatingHoursStructuredSchema])
  .nullable()
  .optional();

export const createHubSchema = {
  body: z.object({
    code: z.string().min(3).max(50).toUpperCase().trim(),
    name: z.string().min(2).max(150).trim(),
    translations: z.record(z.string()).default({}),
    addressLine: z.string().min(3).trim(),
    cityOrTown: z.string().min(2).trim(),
    district: z.string().min(2).trim(),
    state: z.string().min(2).trim(),
    pinCode: z.string().min(4).max(10).trim(),
    contactPhone: z.string().optional(),
    operatingHours: operatingHoursSchema,
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    metadata: z.record(z.unknown()).optional(),
  }),
};

export const updateHubSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(2).max(150).trim().optional(),
    translations: z.record(z.string()).optional(),
    addressLine: z.string().min(3).trim().optional(),
    cityOrTown: z.string().min(2).trim().optional(),
    district: z.string().min(2).trim().optional(),
    state: z.string().min(2).trim().optional(),
    pinCode: z.string().min(4).max(10).trim().optional(),
    contactPhone: z.string().nullable().optional(),
    operatingHours: operatingHoursSchema,
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
};

export const getHubParamsSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

export const nearbyHubsSchema = {
  query: z.object({
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    addressId: z.string().uuid().optional(),
    radiusKm: z.coerce.number().positive().max(500).default(25),
  }),
};

export const listHubsSchema = {
  query: z.object({
    cityOrTown: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
  }),
};

export const assignStaffSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    userId: z.string().uuid(),
    role: z.enum(['STORE_OPERATOR', 'HUB_MANAGER']),
    metadata: z.record(z.unknown()).optional(),
  }),
};

export const removeStaffSchema = {
  params: z.object({
    id: z.string().uuid(),
    staffId: z.string().uuid(),
  }),
};

export const COMPULSORY_HUB_DOCUMENTS = [
  'PAN_CARD',
  'AADHAAR_CARD',
  'OWNER_PHOTO',
  'FSSAI_LICENSE',
  'SHOP_ESTABLISHMENT',
  'PREMISES_PROOF',
  'SHOP_EXTERIOR_PHOTO',
  'SHOP_INTERIOR_PHOTO',
  'CANCELLED_CHEQUE',
  'FRANCHISE_AGREEMENT',
];

export const OPTIONAL_HUB_DOCUMENTS = [
  'GST_CERTIFICATE',
  'WEIGHING_SCALE_CERT',
  'APMC_LICENSE',
  'SECURITY_DEPOSIT_RECEIPT',
];

export const ALL_HUB_DOCUMENTS = [
  ...COMPULSORY_HUB_DOCUMENTS,
  ...OPTIONAL_HUB_DOCUMENTS,
];

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const optionalTrimmedString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((val) => {
    if (val === undefined || val === null) return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
  });

export const adminListHubsSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    state: z.string().trim().optional(),
    district: z.string().trim().optional(),
    hubId: z.string().uuid().optional(),
    onboardingStatus: z
      .enum(['DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED'])
      .optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return undefined;
      }),
    sortBy: z.enum(['name', 'code', 'cityOrTown', 'createdAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),
};

export const staffCandidatesSchema = {
  query: z.object({
    search: z.string().trim().min(2).max(100),
    limit: z.coerce.number().int().min(1).max(25).default(10),
  }),
};

export const upsertFranchiseSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    entityType: z.enum(['PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PVT_LTD']),
    ownerName: z.string().min(2).max(150).trim(),
    ownerPhone: z.string().min(6).max(20).trim(),
    ownerEmail: optionalTrimmedString.refine(
      (val) => !val || z.string().email().safeParse(val).success,
      { message: 'Invalid owner email address.' }
    ),
    panNumber: optionalTrimmedString
      .transform((val) => (val ? val.toUpperCase() : null))
      .refine((val) => !val || panRegex.test(val), {
        message: 'PAN number must follow standard 10-character format (e.g. ABCDE1234F).',
      }),
    gstin: optionalTrimmedString
      .transform((val) => (val ? val.toUpperCase() : null))
      .refine((val) => !val || gstinRegex.test(val), {
        message: 'GSTIN must be a valid 15-character GST number.',
      }),
    fssaiNumber: optionalTrimmedString.refine(
      (val) => !val || /^\d{14}$/.test(val),
      { message: 'FSSAI number must be exactly 14 digits.' }
    ),
    bankAccountHolder: optionalTrimmedString,
    bankAccountNumber: optionalTrimmedString,
    bankIfsc: optionalTrimmedString
      .transform((val) => (val ? val.toUpperCase() : null))
      .refine((val) => !val || ifscRegex.test(val), {
        message: 'IFSC code must follow 11-character format (e.g. SBIN0001234).',
      }),
    bankName: optionalTrimmedString,
    franchiseModel: z.enum(['FOFO', 'FOCO']).default('FOFO'),
    commissionPercent: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((val) => (val === undefined || val === null || val === '' ? null : Number(val)))
      .refine((val) => val === null || (!Number.isNaN(val) && val >= 0 && val <= 100), {
        message: 'Commission percentage must be between 0 and 100.',
      }),
    securityDepositAmount: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((val) => (val === undefined || val === null || val === '' ? null : Number(val)))
      .refine((val) => val === null || (!Number.isNaN(val) && val >= 0), {
        message: 'Security deposit amount must be 0 or greater.',
      }),
    maxCashLimit: z
      .union([z.number(), z.string(), z.null()])
      .optional()
      .transform((val) => (val === undefined || val === null || val === '' ? null : Number(val)))
      .refine((val) => val === null || (!Number.isNaN(val) && val >= 0), {
        message: 'Max cash limit must be 0 or greater.',
      }),
    metadata: z.record(z.unknown()).optional(),
  }),
};

export const registerHubDocumentSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    documentType: z.enum(ALL_HUB_DOCUMENTS),
    bucketType: z.enum(['PRIVATE', 'PUBLIC']),
    storageKey: z.string().min(3).trim(),
    fileName: z.string().min(1).max(255).trim(),
    mimeType: z.string().min(3).max(120).trim(),
    documentNumber: optionalTrimmedString,
    expiryDate: z
      .union([z.string(), z.null()])
      .optional()
      .transform((val) => {
        if (!val || !String(val).trim()) return null;
        return String(val).trim();
      }),
    metadata: z.record(z.unknown()).optional(),
  }),
};

export const verifyHubDocumentSchema = {
  params: z.object({
    id: z.string().uuid(),
    docId: z.string().uuid(),
  }),
  body: z
    .object({
      status: z.enum(['APPROVED', 'REJECTED']),
      rejectionReason: optionalTrimmedString,
    })
    .refine(
      (data) =>
        data.status !== 'REJECTED' ||
        Boolean(data.rejectionReason && data.rejectionReason.length >= 3),
      {
        message: 'Rejection reason (at least 3 characters) is required when rejecting.',
        path: ['rejectionReason'],
      }
    ),
};

export const hubDocumentUrlParamsSchema = {
  params: z.object({
    id: z.string().uuid(),
    docId: z.string().uuid(),
  }),
};

export const updateOnboardingStatusSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    onboardingStatus: z.enum(['DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED']),
    force: z.boolean().optional().default(false),
  }),
};
