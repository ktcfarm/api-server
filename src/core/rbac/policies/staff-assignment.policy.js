import { BasePolicy } from '../policy.interface.js';

export class StaffAssignmentPolicy extends BasePolicy {
  constructor() {
    super('STAFF_ASSIGNMENT');
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
      if (
        isSuperAdminHolder &&
        (effectiveRole === 'HUB_MANAGER' || effectiveRole === 'STORE_OPERATOR')
      ) {
        return true;
      }

      return user.staffAssignments.some(
        (s) => s.hubId === targetHubId && s.isActive
      );
    }

    if (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE') {
      if (isSuperAdminHolder && effectiveRole === 'HUB_MANAGER') {
        return true;
      }

      return user.staffAssignments.some(
        (s) => s.hubId === targetHubId && s.role === 'HUB_MANAGER' && s.isActive
      );
    }

    return false;
  }
}

export const staffAssignmentPolicy = new StaffAssignmentPolicy();
