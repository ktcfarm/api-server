import { cropPolicy } from './policies/crop.policy.js';
import { hubPolicy } from './policies/hub.policy.js';
import { mandiRatePolicy } from './policies/mandi-rate.policy.js';
import { staffAssignmentPolicy } from './policies/staff-assignment.policy.js';

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

export class ForbiddenError extends Error {
  constructor(action, resource, reason = 'Insufficient permissions') {
    super(`Forbidden: Cannot perform ${action} on ${resource}. Reason: ${reason}`);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

export class PolicyGuard {
  constructor() {
    this.policies = new Map();
  }

  registerPolicy(policy) {
    this.policies.set(policy.resource, policy);
    return this;
  }

  async can(context) {
    const { user, resource } = context;

    if (!user || user.status !== 'ACTIVE') {
      return false;
    }

    const userRoles = Array.isArray(user.roles) ? user.roles : [];
    const effectiveRole =
      user.activeRole ||
      (userRoles.includes('SUPER_ADMIN')
        ? 'SUPER_ADMIN'
        : userRoles.includes('ADMIN')
          ? 'ADMIN'
          : userRoles[0]);

    if (effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMIN') {
      return true;
    }

    const policy = this.policies.get(resource);
    if (!policy) {
      return false;
    }

    return policy.evaluate(context);
  }

  async enforce(context) {
    const allowed = await this.can(context);
    if (!allowed) {
      throw new ForbiddenError(context.action, context.resource);
    }
  }
}

export const globalPolicyGuard = new PolicyGuard();
globalPolicyGuard.registerPolicy(hubPolicy);
globalPolicyGuard.registerPolicy(staffAssignmentPolicy);
globalPolicyGuard.registerPolicy(cropPolicy);
globalPolicyGuard.registerPolicy(mandiRatePolicy);
