import { z } from 'zod';
import {
  SUPPORTED_LANGUAGES,
  isValidNormalizedPhone,
  normalizePhone,
} from './auth.utils.js';

const pinRegex = /^\d{6}$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const accountNumberRegex = /^[A-Za-z0-9]{6,24}$/;
const upiVpaRegex = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9.-]{2,}$/;

const optionalNormalizedPhoneSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (typeof val !== 'string') return null;
    const trimmed = val.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  .refine((val) => val === null || isValidNormalizedPhone(val), {
    message: 'Enter a valid 10-digit Indian mobile number or E.164 phone number',
  })
  .transform((val) => (val === null ? null : normalizePhone(val)));

export const sendOtpSchema = {
  body: z.object({
    identifier: z.string().min(3).trim(),
    channel: z.enum(['EMAIL', 'SMS', 'IN_APP']).default('EMAIL'),
    purpose: z.enum([
      'REGISTER',
      'LOGIN',
      'RESET_PIN',
      'VERIFY_EMAIL',
      'VERIFY_PHONE',
      'CASH_HANDOVER',
    ]),
    metadata: z.record(z.unknown()).optional(),
  }),
};

export const registerSchema = {
  body: z.object({
    email: z.string().email().toLowerCase().trim(),
    otp: z.string().trim().length(6, 'OTP must be 6 digits'),
    name: z.string().min(2).max(100).trim(),
    pin: z.string().regex(pinRegex, 'PIN must be exactly 6 numeric digits'),
    phone: optionalNormalizedPhoneSchema,
    languagePref: z.enum(SUPPORTED_LANGUAGES).default('en'),
    termsAccepted: z
      .boolean()
      .default(true)
      .refine((val) => val === true, 'Terms and conditions must be accepted'),
    intendedRole: z.enum(['BUYER', 'FARMER']).default('BUYER'),
    farmerDetails: z
      .object({
        fatherName: z.string().max(100).trim().optional(),
        village: z.string().max(100).trim().optional(),
        tehsilOrBlock: z.string().max(100).trim().optional(),
        district: z.string().max(100).trim().optional(),
        state: z.string().max(100).trim().optional(),
        pinCode: z.string().max(10).trim().optional(),
        landSizeRange: z.string().max(50).trim().optional(),
        landAreaAcres: z.coerce.number().positive().max(10000).optional(),
        primaryProduce: z.array(z.string().min(1).max(100).trim()).optional(),
      })
      .optional(),
  }),
};

export const loginPinSchema = {
  body: z.object({
    identifier: z.string().min(3).trim(),
    pin: z.string().regex(pinRegex, 'PIN must be exactly 6 numeric digits'),
    targetRole: z.enum([
      'BUYER',
      'FARMER',
      'STORE_OPERATOR',
      'HUB_MANAGER',
      'ADMIN',
      'SUPER_ADMIN',
    ]),
  }),
};

export const loginOtpSchema = {
  body: z.object({
    identifier: z.string().min(3).trim(),
    otp: z.string().trim().length(6, 'OTP must be 6 digits'),
    targetRole: z.enum([
      'BUYER',
      'FARMER',
      'STORE_OPERATOR',
      'HUB_MANAGER',
      'ADMIN',
      'SUPER_ADMIN',
    ]),
  }),
};

export const farmerIdentitySchema = {
  body: z.object({
    fullName: z.string().min(2).max(100).trim(),
    fatherOrSpouseName: z.string().min(2).max(100).trim().optional().nullable(),
    aadhaarNumber: z
      .string()
      .transform((val) => val.replace(/\D/g, ''))
      .refine((digits) => /^\d{12}$/.test(digits), {
        message: 'Aadhaar number must be exactly 12 digits',
      }),
    verificationMethod: z.enum(['UIDAI_OTP', 'DIGILOCKER', 'MANUAL']).default('UIDAI_OTP'),
    consentAccepted: z.literal(true, {
      errorMap: () => ({ message: 'Aadhaar e-KYC consent is required' }),
    }),
    profilePhotoKey: z.string().min(3).max(500).trim().optional().nullable(),
    aadhaarDocumentKey: z.string().min(3).max(500).trim().optional().nullable(),
    digiLockerReferenceId: z.string().max(120).trim().optional().nullable(),
  }),
};

export const farmerLocationSchema = {
  body: z
    .object({
      state: z.string().min(2).max(100).trim(),
      district: z.string().min(2).max(100).trim(),
      tehsilOrBlock: z.string().min(2).max(100).trim(),
      village: z.string().min(2).max(100).trim(),
      pinCode: z.string().trim().regex(/^\d{6}$/, 'PIN code must be exactly 6 numeric digits'),
      landSizeRange: z.string().min(1).max(50).trim().optional().nullable(),
      landAreaAcres: z.coerce.number().positive().max(10000).optional().nullable(),
      primaryProduce: z.array(z.string().min(1).max(100).trim()).min(1).max(20),
      latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
      longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
      gpsAccuracyMeters: z.coerce.number().nonnegative().max(50000).optional().nullable(),
    })
    .superRefine((data, ctx) => {
      const hasLat = data.latitude !== null && data.latitude !== undefined;
      const hasLng = data.longitude !== null && data.longitude !== undefined;
      if (hasLat !== hasLng) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Both latitude and longitude must be provided together',
          path: ['latitude'],
        });
      }
    }),
};

export const payoutDetailsObject = z.object({
  payoutChannel: z.enum(['BANK', 'UPI']),
  accountHolderName: z.string().min(2).max(120).trim().optional(),
  accountNumber: z
    .string()
    .trim()
    .transform((val) => val.replace(/\s+/g, ''))
    .optional()
    .nullable(),
  confirmAccountNumber: z
    .string()
    .trim()
    .transform((val) => val.replace(/\s+/g, ''))
    .optional()
    .nullable(),
  ifscCode: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable(),
  bankName: z.string().max(120).trim().optional().nullable(),
  branchName: z.string().max(120).trim().optional().nullable(),
  upiVpa: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .nullable(),
});

export function validatePayoutChannelFields(data, ctx) {
  if (data.payoutChannel === 'BANK') {
    if (!data.accountNumber || !accountNumberRegex.test(data.accountNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Account number must be 6 to 24 alphanumeric characters',
        path: ['accountNumber'],
      });
    }
    if (
      data.confirmAccountNumber &&
      data.accountNumber &&
      data.confirmAccountNumber !== data.accountNumber
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Account number confirmation does not match',
        path: ['confirmAccountNumber'],
      });
    }
    if (!data.ifscCode || !ifscRegex.test(data.ifscCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'IFSC code must match RBI 11-character format (e.g. SBIN0001452)',
        path: ['ifscCode'],
      });
    }
  }

  if (data.payoutChannel === 'UPI') {
    if (!data.upiVpa || !upiVpaRegex.test(data.upiVpa)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid UPI VPA (e.g. farmer@okhdfcbank)',
        path: ['upiVpa'],
      });
    }
  }
}

export const farmerPayoutSchema = {
  body: payoutDetailsObject
    .extend({
      consentAccepted: z.literal(true, {
        errorMap: () => ({ message: 'Bank ownership declaration is required' }),
      }),
    })
    .superRefine(validatePayoutChannelFields),
};

export const farmerOnboardingSchema = {
  body: z.object({
    fatherName: z.string().optional(),
    village: z.string().min(2).trim(),
    tehsilOrBlock: z.string().min(2).trim(),
    district: z.string().min(2).trim(),
    state: z.string().min(2).trim(),
    pinCode: z.string().min(6).max(6).trim(),
    landSizeRange: z.string().max(50).trim().optional(),
    landAreaAcres: z.coerce.number().positive().optional(),
    primaryProduce: z.array(z.string().min(1).trim()).optional(),
  }),
};

export const resetPinSchema = {
  body: z.object({
    identifier: z.string().min(3).trim(),
    otp: z.string().trim().length(6),
    newPin: z.string().regex(pinRegex, 'New PIN must be exactly 6 numeric digits'),
  }),
};

export const refreshTokenSchema = {
  body: z.object({
    refreshToken: z.string().min(10),
  }),
};

export const verifyIdentifierSchema = {
  body: z.object({
    identifier: z.string().min(3).trim(),
    channel: z.enum(['EMAIL', 'SMS']),
    otp: z.string().trim().length(6),
  }),
};

export const switchRoleSchema = {
  body: z.object({
    targetRole: z.enum([
      'BUYER',
      'FARMER',
      'SUPER_ADMIN',
      'ADMIN',
      'HUB_MANAGER',
      'STORE_OPERATOR',
    ]),
  }),
};
