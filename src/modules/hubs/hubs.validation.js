import { z } from 'zod';

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
    operatingHours: z.string().optional(),
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
    contactPhone: z.string().optional(),
    operatingHours: z.string().optional(),
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
