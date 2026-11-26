import { PrismaClient } from '@prisma/client';

const logLevels =
  process.env.PRISMA_LOG_QUERIES === 'true'
    ? ['query', 'error', 'warn']
    : ['error', 'warn'];

export const prisma = new PrismaClient({
  log: logLevels,
});
