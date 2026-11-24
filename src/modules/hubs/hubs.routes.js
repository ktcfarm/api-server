import { Router } from 'express';
import {
  authMiddleware,
  optionalAuthMiddleware,
} from '../../core/middleware/auth.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { hubsController } from './hubs.controller.js';
import {
  assignStaffSchema,
  createHubSchema,
  getHubParamsSchema,
  listHubsSchema,
  nearbyHubsSchema,
  removeStaffSchema,
  updateHubSchema,
} from './hubs.validation.js';

const router = Router();

router.post(
  '/',
  authMiddleware,
  validate(createHubSchema),
  hubsController.createHub.bind(hubsController)
);

router.get(
  '/nearby',
  optionalAuthMiddleware,
  validate(nearbyHubsSchema),
  hubsController.getNearbyHubs.bind(hubsController)
);

router.get(
  '/',
  validate(listHubsSchema),
  hubsController.listHubs.bind(hubsController)
);

router.get(
  '/:id',
  validate(getHubParamsSchema),
  hubsController.getHubById.bind(hubsController)
);

router.patch(
  '/:id',
  authMiddleware,
  validate(updateHubSchema),
  hubsController.updateHub.bind(hubsController)
);

router.post(
  '/:id/staff',
  authMiddleware,
  validate(assignStaffSchema),
  hubsController.assignStaff.bind(hubsController)
);

router.get(
  '/:id/staff',
  authMiddleware,
  validate(getHubParamsSchema),
  hubsController.getStaff.bind(hubsController)
);

router.delete(
  '/:id/staff/:staffId',
  authMiddleware,
  validate(removeStaffSchema),
  hubsController.removeStaff.bind(hubsController)
);

export const hubsRouter = router;
