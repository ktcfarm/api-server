import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { catalogAdminRouter } from '../modules/catalog/catalog.admin.routes.js';
import { dashboardAdminRouter } from '../modules/dashboard/dashboard.admin.routes.js';
import { hubsAdminRouter } from '../modules/hubs/hubs.admin.routes.js';
import { pricingAdminRouter } from '../modules/pricing/pricing.admin.routes.js';
import { storageRouter } from '../modules/storage/storage.routes.js';

export const adminRouter = Router();

adminRouter.use('/auth', authRouter);
adminRouter.use('/catalog', catalogAdminRouter);
adminRouter.use('/dashboard', dashboardAdminRouter);
adminRouter.use('/hubs', hubsAdminRouter);
adminRouter.use('/pricing', pricingAdminRouter);
adminRouter.use('/storage', storageRouter);
