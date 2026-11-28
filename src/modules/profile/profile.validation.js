import { z } from 'zod';
import {
  SUPPORTED_LANGUAGES,
  isValidNormalizedPhone,
  normalizePhone,
} from '../auth/auth.utils.js';
import {
  payoutDetailsObject,
  validatePayoutChannelFields,
} from '../auth/auth.validation.js';

const optionalNullableTrimmed = (max) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (typeof val !== 'string') return null;
      const trimmed = val.trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .refine((val) => val === null || val.length <= max, {
      message: `Must be ${max} characters or fewer`,
    });

export const updateProfileSchema = {
  body: z
    .object({
      name: z.string().min(2).max(100).trim().optional(),
      languagePref: z.enum(SUPPORTED_LANGUAGES).optional(),
      avatarKey: z.string().min(3).max(500).trim().nullable().optional(),
      preferences: z
        .object({
          instantOutbids: z.boolean().optional(),
          dailyMandiRateSms: z.boolean().optional(),
          weighbridgePayoutAlerts: z.boolean().optional(),
        })
        .optional(),
      buyerProfile: z
        .object({
          businessName: optionalNullableTrimmed(150).optional(),
          businessType: z
            .enum(['INDIVIDUAL', 'RETAILER', 'WHOLESALER', 'PROCESSOR', 'OTHER'])
            .optional(),
          gstin: optionalNullableTrimmed(20).optional(),
          panNumber: optionalNullableTrimmed(20).optional(),
          city: optionalNullableTrimmed(120).optional(),
        })
        .optional(),
    })
    .refine(
      (data) =>
        data.name !== undefined ||
        data.languagePref !== undefined ||
        data.avatarKey !== undefined ||
        data.preferences !== undefined ||
        data.buyerProfile !== undefined,
      {
        message: 'At least one profile field must be provided',
      }
    ),
};

export const createBankAccountSchema = {
  body: payoutDetailsObject
    .extend({
      isDefault: z.boolean().optional().default(true),
    })
    .superRefine(validatePayoutChannelFields),
};

export const bankAccountParamsSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

const addressBaseObject = z.object({
  label: z.enum(['SHOP', 'WAREHOUSE', 'HOME', 'OTHER']).default('HOME'),
  title: z.string().min(2).max(150).trim(),
  facilityType: z.string().max(80).trim().optional(),
  bayShort: z.string().max(80).trim().optional(),
  contactName: z.string().min(2).max(100).trim(),
  contactPhone: z
    .string()
    .trim()
    .refine((val) => isValidNormalizedPhone(val), {
      message: 'Enter a valid 10-digit Indian mobile number or E.164 phone number',
    })
    .transform((val) => normalizePhone(val)),
  altMobile: optionalNullableTrimmed(30).optional(),
  addressLine1: z.string().min(3).max(250).trim(),
  addressLine2: optionalNullableTrimmed(200).optional(),
  landmark: optionalNullableTrimmed(200).optional(),
  tehsilOrBlock: optionalNullableTrimmed(100).optional(),
  cityOrTown: z.string().min(2).max(100).trim().default('Navi Mumbai'),
  district: z.string().min(2).max(100).trim().default('Thane'),
  state: z.string().min(2).max(100).trim().default('Maharashtra'),
  pinCode: z.string().trim().regex(/^\d{6}$/, 'PIN code must be exactly 6 digits'),
  country: z.string().trim().min(2).max(4).toUpperCase().optional().default('IN'),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  hasWeighbridge: z.boolean().optional().default(false),
  supportsHeavyTruck: z.boolean().optional().default(false),
  requiresForklift: z.boolean().optional().default(false),
  isDefault: z.boolean().optional().default(false),
});

function validateCoordinatesPair(data, ctx) {
  const hasLat = data.latitude !== null && data.latitude !== undefined;
  const hasLng = data.longitude !== null && data.longitude !== undefined;
  if (hasLat !== hasLng) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Both latitude and longitude must be provided together',
      path: ['latitude'],
    });
  }
}

export const createAddressSchema = {
  body: addressBaseObject.superRefine(validateCoordinatesPair),
};

export const updateAddressSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
  body: addressBaseObject
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one address field must be provided',
    })
    .superRefine(validateCoordinatesPair),
};

export const addressParamsSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};
