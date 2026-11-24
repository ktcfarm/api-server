import { hubPolicy } from './policies/hub.policy.js';
import { staffAssignmentPolicy } from './policies/staff-assignment.policy.js';

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(action, resource, reason = 'Insufficient permissions') {
    super(`Forbidden: Cannot perform ${action} on ${resource}. Reason: ${reason}`);
    this.name = 'ForbiddenError';
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

    if (Array.isArray(user.roles)) {
      if (user.roles.includes('SUPER_ADMIN')) {
        return true;
      }
      if (user.roles.includes('ADMIN')) {
        return true;
      }
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
