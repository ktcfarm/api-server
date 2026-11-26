import { ACTIONS } from '../actions.js';
import { BasePolicy } from '../policy.interface.js';

export class MandiRatePolicy extends BasePolicy {
  constructor() {
    super('MANDI_RATE');
  }

  evaluate(context) {
    const { user, action, hubId, data } = context;
    const targetHubId = hubId !== undefined ? hubId : data?.hubId ?? null;

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

    if (action === 'VIEW' || action === ACTIONS.MANDI_RATE.VIEW) {
      if (!targetHubId || isSuperAdminHolder) {
        return ['HUB_MANAGER', 'STORE_OPERATOR', 'FARMER', 'BUYER'].includes(
          effectiveRole
        );
      }
      return (user.staffAssignments || []).some(
        (s) => s.hubId === targetHubId && s.isActive
      );
    }

    if (action === ACTIONS.MANDI_RATE.SET_HUB) {
      if (!targetHubId || effectiveRole !== 'HUB_MANAGER') {
        return false;
      }
      if (isSuperAdminHolder) {
        return true;
      }
      return (user.staffAssignments || []).some(
        (s) =>
          s.hubId === targetHubId && s.role === 'HUB_MANAGER' && s.isActive
      );
    }

    return false;
  }
}

export const mandiRatePolicy = new MandiRatePolicy();
