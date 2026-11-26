import { ACTIONS } from '../actions.js';
import { BasePolicy } from '../policy.interface.js';

export class CropPolicy extends BasePolicy {
  constructor() {
    super('CROP');
  }

  evaluate(context) {
    const { user, action } = context;

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

    if (action === 'VIEW' || action === ACTIONS.CROP.VIEW) {
      return ['HUB_MANAGER', 'STORE_OPERATOR', 'FARMER', 'BUYER'].includes(effectiveRole);
    }

    return false;
  }
}

export const cropPolicy = new CropPolicy();
