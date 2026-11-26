import { BasePolicy } from '../policy.interface.js';

export class HubPolicy extends BasePolicy {
  constructor() {
    super('HUB');
  }

  evaluate(context) {
    const { user, action, hubId, data } = context;
    const targetHubId = hubId || data?.hubId;

    if (!user || user.status !== 'ACTIVE') {
      return false;
    }

    const userRoles = Array.isArray(user.roles) ? user.roles : [];
    const isSuperAdminHolder = userRoles.includes('SUPER_ADMIN');
    const effectiveRole =
      user.activeRole ||
      (isSuperAdminHolder
        ? 'SUPER_ADMIN'
        : userRoles.includes('ADMIN')
          ? 'ADMIN'
          : userRoles[0]);

    if (effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMIN') {
      return true;
    }

    if (action === 'READ') {
      if (isSuperAdminHolder || !targetHubId) {
        return true;
      }
      return user.staffAssignments.some(
        (s) => s.hubId === targetHubId && s.isActive
      );
    }

    if (action === 'UPDATE') {
      if (data?.restrictedFieldsPresent) {
        return false;
      }

      if (isSuperAdminHolder && effectiveRole === 'HUB_MANAGER') {
        return true;
      }

      return user.staffAssignments.some(
        (s) => s.hubId === targetHubId && s.role === 'HUB_MANAGER' && s.isActive
      );
    }

    if (action === 'DISPATCH' || action === 'EXECUTE') {
      if (
        isSuperAdminHolder &&
        (effectiveRole === 'HUB_MANAGER' || effectiveRole === 'STORE_OPERATOR')
      ) {
        return true;
      }

      return user.staffAssignments.some(
        (s) =>
          s.hubId === targetHubId &&
          (s.role === 'STORE_OPERATOR' || s.role === 'HUB_MANAGER') &&
          s.isActive
      );
    }

    return false;
  }
}

export const hubPolicy = new HubPolicy();
