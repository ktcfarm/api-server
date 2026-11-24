import pino from 'pino';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    : undefined
});

export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    };

    if (res.statusCode >= 500) {
      logger.error(logData, `${req.method} ${req.originalUrl || req.url} ${res.statusCode} in ${duration}ms`);
    } else if (res.statusCode >= 400) {
      logger.warn(logData, `${req.method} ${req.originalUrl || req.url} ${res.statusCode} in ${duration}ms`);
    } else {
      logger.info(logData, `${req.method} ${req.originalUrl || req.url} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
};
