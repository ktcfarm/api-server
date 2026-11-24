import { ForbiddenError, UnauthorizedError } from '../errors/app.error.js';
import { globalPolicyGuard } from '../rbac/policy.guard.js';

export const requireRoles = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
    if (userRoles.includes('SUPER_ADMIN') || userRoles.includes('ADMIN')) {
      return next();
    }

    const hasAllowedRole = allowedRoles.some((role) => userRoles.includes(role));
    if (!hasAllowedRole) {
      return next(new ForbiddenError('Access forbidden: insufficient role permissions'));
    }

    return next();
  };
};

export const authorize = (action, resource, contextResolver) => {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      let extraContext = {};
      if (typeof contextResolver === 'function') {
        extraContext = await contextResolver(req);
      }

      const context = {
        user: req.user,
        staffAssignment: req.staffAssignment,
        action,
        resource,
        ...extraContext
      };

      await globalPolicyGuard.enforce(context);
      return next();
    } catch (error) {
      if (error.name === 'ForbiddenError' && !error.statusCode) {
        return next(new ForbiddenError(error.message));
      }
      return next(error);
    }
  };
};
