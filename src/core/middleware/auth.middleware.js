import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../database/prisma.js';
import { UnauthorizedError } from '../errors/app.error.js';

const AUTH_CACHE_TTL_MS = 30 * 1000;
const AUTH_CACHE_MAX_SIZE = 5000;
const authCache = new Map();

export function invalidateAuthCache(sessionId) {
  if (!sessionId) return;
  authCache.delete(sessionId);
}

function setCachedAuth(sessionId, entry) {
  if (authCache.size >= AUTH_CACHE_MAX_SIZE) {
    const now = Date.now();
    for (const [key, value] of authCache.entries()) {
      if (value.expiresAt <= now) {
        authCache.delete(key);
      }
    }
    if (authCache.size >= AUTH_CACHE_MAX_SIZE) {
      authCache.clear();
    }
  }
  authCache.set(sessionId, entry);
}

export async function authMiddleware(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = authHeader.split(' ')[1];
    let decoded;

    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Access token has expired');
      }
      throw new UnauthorizedError('Invalid access token');
    }

    const { sub: userId, sessionId, activeRole } = decoded;

    const now = Date.now();
    const cached = sessionId ? authCache.get(sessionId) : null;
    if (cached) {
      if (cached.expiresAt > now && cached.userId === userId) {
        if (cached.sessionExpiresAt <= now) {
          authCache.delete(sessionId);
          throw new UnauthorizedError('Session has expired or was revoked');
        }
        const cachedRoles = cached.user.roles;
        const isSuperAdmin = cachedRoles.includes('SUPER_ADMIN');
        if (activeRole && !cachedRoles.includes(activeRole) && !isSuperAdmin) {
          throw new UnauthorizedError(`User does not possess active role ${activeRole}`);
        }
        req.user = {
          ...cached.user,
          activeRole: activeRole || cached.user.activeRole,
        };
        return next();
      }
      authCache.delete(sessionId);
    }

    const [user, session] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        relationLoadStrategy: 'join',
        include: {
          roles: true,
          staffAssignments: {
            where: { isActive: true },
            include: {
              hub: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  cityOrTown: true,
                  isActive: true,
                },
              },
            },
          },
        },
      }),
      prisma.userSession.findUnique({
        where: { id: sessionId },
      }),
    ]);

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is inactive or not found');
    }

    if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
      throw new UnauthorizedError('Session has expired or was revoked');
    }

    const userRoles = user.roles.map((r) => r.role);
    const isSuperAdmin = userRoles.includes('SUPER_ADMIN');

    if (activeRole && !userRoles.includes(activeRole) && !isSuperAdmin) {
      throw new UnauthorizedError(`User does not possess active role ${activeRole}`);
    }

    const hydratedUser = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      status: user.status,
      roles: userRoles,
      staffAssignments: user.staffAssignments.map((s) => ({
        hubId: s.hubId,
        role: s.role,
        isActive: s.isActive,
        hubName: s.hub?.name || null,
        hubCode: s.hub?.code || null,
      })),
      activeRole: activeRole || userRoles[0] || 'BUYER',
      sessionId: session.id,
    };

    setCachedAuth(session.id, {
      userId: user.id,
      user: hydratedUser,
      sessionExpiresAt: new Date(session.expiresAt).getTime(),
      expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
    });

    req.user = hydratedUser;

    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuthMiddleware(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

    const now = Date.now();
    const cached = decoded.sessionId ? authCache.get(decoded.sessionId) : null;
    if (
      cached &&
      cached.expiresAt > now &&
      cached.userId === decoded.sub &&
      cached.sessionExpiresAt > now
    ) {
      req.user = {
        ...cached.user,
        activeRole: decoded.activeRole || cached.user.activeRole,
      };
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      relationLoadStrategy: 'join',
      include: {
        roles: true,
        staffAssignments: { where: { isActive: true } },
      },
    });

    if (user && user.status === 'ACTIVE') {
      const userRoles = user.roles.map((r) => r.role);
      req.user = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        status: user.status,
        roles: userRoles,
        staffAssignments: user.staffAssignments.map((s) => ({
          hubId: s.hubId,
          role: s.role,
          isActive: s.isActive,
        })),
        activeRole: decoded.activeRole || userRoles[0] || 'BUYER',
        sessionId: decoded.sessionId,
      };
    }
  } catch {
    return next();
  }

  next();
}
