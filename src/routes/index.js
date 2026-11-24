import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { hubsRouter } from '../modules/hubs/hubs.routes.js';
import { storageRouter } from '../modules/storage/storage.routes.js';
import { adminRouter } from './admin.routes.js';
import { appRouter } from './app.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ktc-backend',
  });
});

apiRouter.use('/app', appRouter);
apiRouter.use('/admin', adminRouter);

apiRouter.use('/auth', authRouter);
apiRouter.use('/hubs', hubsRouter);
apiRouter.use('/storage', storageRouter);
