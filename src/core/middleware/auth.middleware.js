import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../database/prisma.js';
import { UnauthorizedError } from '../errors/app.error.js';

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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        staffAssignments: {
          where: { isActive: true },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is inactive or not found');
    }

    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
      throw new UnauthorizedError('Session has expired or was revoked');
    }

    const userRoles = user.roles.map((r) => r.role);

    if (activeRole && !userRoles.includes(activeRole)) {
      throw new UnauthorizedError(`User does not possess active role ${activeRole}`);
    }

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
      activeRole: activeRole || userRoles[0] || 'BUYER',
      sessionId: session.id,
    };

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

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
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
    // Intentionally pass without assigning req.user on token failure
  }

  next();
}
