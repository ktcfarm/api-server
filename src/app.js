import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './core/config/env.js';
import { NotFoundError } from './core/errors/app.error.js';
import { errorMiddleware } from './core/errors/error.middleware.js';
import { requestLogger } from './core/logging/logger.js';
import { apiRateLimiter } from './core/middleware/rate-limit.middleware.js';
import { requestIdMiddleware } from './core/middleware/request-id.middleware.js';
import { apiRouter } from './routes/index.js';

export const app = express();

const allowedOrigins = env.CORS_ADMIN_ORIGINS
  ? env.CORS_ADMIN_ORIGINS.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);
app.use(requestLogger);

app.use('/api/v1', apiRateLimiter, apiRouter);

app.use((req, _res, next) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
});

app.use(errorMiddleware);
