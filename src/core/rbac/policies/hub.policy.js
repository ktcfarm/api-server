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

    if (user.roles.includes('SUPER_ADMIN') || user.roles.includes('ADMIN')) {
      return true;
    }

    if (action === 'READ') {
      return true;
    }

    if (action === 'UPDATE') {
      const isHubManager = user.staffAssignments.some(
        (s) => s.hubId === targetHubId && s.role === 'HUB_MANAGER' && s.isActive
      );

      if (!isHubManager) {
        return false;
      }

      if (data?.restrictedFieldsPresent) {
        return false;
      }

      return true;
    }

    if (action === 'DISPATCH' || action === 'EXECUTE') {
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
