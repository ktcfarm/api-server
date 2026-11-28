import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware.js';
import { requireRoles } from '../../core/middleware/authorize.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { dashboardAdminController } from './dashboard.admin.controller.js';
import { dashboardSummarySchema } from './dashboard.validation.js';

const router = Router();

router.use(authMiddleware);

router.get(
  '/summary',
  requireRoles('STORE_OPERATOR', 'HUB_MANAGER', 'ADMIN', 'SUPER_ADMIN'),
  validate(dashboardSummarySchema),
  dashboardAdminController.getSummary.bind(dashboardAdminController)
);

export const dashboardAdminRouter = router;
