import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { hubsRouter } from '../modules/hubs/hubs.routes.js';
import { storageRouter } from '../modules/storage/storage.routes.js';

export const adminRouter = Router();

adminRouter.use('/auth', authRouter);
adminRouter.use('/hubs', hubsRouter);
adminRouter.use('/storage', storageRouter);
