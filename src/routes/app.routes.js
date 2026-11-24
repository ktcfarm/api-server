import { Router } from 'express';
import { optionalAuthMiddleware } from '../core/middleware/auth.middleware.js';
import { validate } from '../core/middleware/validate.middleware.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { hubsController } from '../modules/hubs/hubs.controller.js';
import {
  getHubParamsSchema,
  listHubsSchema,
  nearbyHubsSchema,
} from '../modules/hubs/hubs.validation.js';
import { storageRouter } from '../modules/storage/storage.routes.js';

export const appRouter = Router();

const mobileHubRouter = Router();

mobileHubRouter.get(
  '/nearby',
  optionalAuthMiddleware,
  validate(nearbyHubsSchema),
  hubsController.getNearbyHubs.bind(hubsController)
);

mobileHubRouter.get(
  '/',
  validate(listHubsSchema),
  hubsController.listHubs.bind(hubsController)
);

mobileHubRouter.get(
  '/:id',
  validate(getHubParamsSchema),
  hubsController.getHubById.bind(hubsController)
);

appRouter.use('/auth', authRouter);
appRouter.use('/hubs', mobileHubRouter);
appRouter.use('/storage', storageRouter);
