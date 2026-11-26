import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { pricingAdminController } from './pricing.admin.controller.js';
import {
  bulkUpsertRatesSchema,
  createRateSchema,
  listRatesSchema,
  rateIdParamsSchema,
  resolveRateSchema,
  updateRateSchema,
  updateRateStatusSchema,
} from './pricing.validation.js';

const router = Router();

router.use(authMiddleware);

router.get(
  '/rates',
  validate(listRatesSchema),
  pricingAdminController.listRates.bind(pricingAdminController)
);

router.get(
  '/resolve',
  validate(resolveRateSchema),
  pricingAdminController.resolveRate.bind(pricingAdminController)
);

router.get(
  '/rates/:id',
  validate(rateIdParamsSchema),
  pricingAdminController.getRateById.bind(pricingAdminController)
);

router.post(
  '/rates',
  validate(createRateSchema),
  pricingAdminController.createRate.bind(pricingAdminController)
);

router.post(
  '/rates/bulk-upsert',
  validate(bulkUpsertRatesSchema),
  pricingAdminController.bulkUpsertRates.bind(pricingAdminController)
);

router.patch(
  '/rates/:id',
  validate(updateRateSchema),
  pricingAdminController.updateRate.bind(pricingAdminController)
);

router.patch(
  '/rates/:id/status',
  validate(updateRateStatusSchema),
  pricingAdminController.updateRateStatus.bind(pricingAdminController)
);

export const pricingAdminRouter = router;
