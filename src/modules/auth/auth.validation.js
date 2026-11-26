import { z } from 'zod';

const pinRegex = /^\d{6}$/;

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
  }),
};

export const registerSchema = {
  body: z.object({
    email: z.string().email().toLowerCase().trim(),
    otp: z.string().length(6),
    name: z.string().min(2).max(100).trim(),
    pin: z.string().regex(pinRegex, 'PIN must be exactly 6 numeric digits'),
    phone: z.string().optional(),
    intendedRole: z.enum(['BUYER', 'FARMER']).default('BUYER'),
    farmerDetails: z
      .object({
        fatherName: z.string().optional(),
        village: z.string().optional(),
        tehsilOrBlock: z.string().optional(),
        district: z.string().optional(),
        state: z.string().optional(),
        pinCode: z.string().optional(),
        landAreaAcres: z.number().positive().optional(),
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
    otp: z.string().length(6),
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

export const farmerOnboardingSchema = {
  body: z.object({
    fatherName: z.string().optional(),
    village: z.string().min(2).trim(),
    tehsilOrBlock: z.string().min(2).trim(),
    district: z.string().min(2).trim(),
    state: z.string().min(2).trim(),
    pinCode: z.string().min(6).max(6).trim(),
    landAreaAcres: z.number().positive().optional(),
  }),
};

export const resetPinSchema = {
  body: z.object({
    identifier: z.string().min(3).trim(),
    otp: z.string().length(6),
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
    otp: z.string().length(6),
  }),
};

export const switchRoleSchema = {
  body: z.object({
    targetRole: z.enum(['SUPER_ADMIN', 'ADMIN', 'HUB_MANAGER', 'STORE_OPERATOR']),
  }),
};
