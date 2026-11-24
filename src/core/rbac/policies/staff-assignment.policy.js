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

    if (user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN')) {
      return true;
    }

    if (action === 'READ') {
      return user.staffAssignments.some(
        (s) => s.hubId === targetHubId && s.isActive
      );
    }

    if (action === 'CREATE' || action === 'UPDATE' || action === 'DELETE') {
      return user.staffAssignments.some(
        (s) => s.hubId === targetHubId && s.role === 'HUB_MANAGER' && s.isActive
      );
    }

    return false;
  }
}

export const staffAssignmentPolicy = new StaffAssignmentPolicy();
