import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../core/errors/app.error.js';
import { globalPolicyGuard } from '../../core/rbac/policy.guard.js';
import { hubsRepository } from './hubs.repository.js';

export class HubsService {
  async createHub(data, actor) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: 'CREATE',
      resource: 'HUB',
    });

    const existing = await hubsRepository.findHubByCode(data.code);
    if (existing) {
      throw new ConflictError(`A KTS Hub with code "${data.code}" already exists.`);
    }

    return hubsRepository.createHub(data);
  }

  async updateHub(hubId, data, actor) {
    const hub = await hubsRepository.findHubById(hubId);
    if (!hub) {
      throw new NotFoundError('KTS Hub not found.');
    }

    const isAdmin =
      actor.roles.includes('SUPER_ADMIN') || actor.roles.includes('ADMIN');

    if (!isAdmin) {
      const restrictedKeys = [
        'name',
        'code',
        'addressLine',
        'cityOrTown',
        'district',
        'state',
        'pinCode',
        'latitude',
        'longitude',
        'isActive',
      ];

      const hasRestrictedField = Object.keys(data).some((k) =>
        restrictedKeys.includes(k)
      );

      if (hasRestrictedField) {
        throw new ForbiddenError(
          'Hub Managers may only update operational fields: operatingHours, contactPhone, and metadata.'
        );
      }
    }

    await globalPolicyGuard.enforce({
      user: actor,
      action: 'UPDATE',
      resource: 'HUB',
      hubId,
      data,
    });

    return hubsRepository.updateHub(hubId, data);
  }

  async getHubById(hubId) {
    const hub = await hubsRepository.findHubById(hubId);
    if (!hub) {
      throw new NotFoundError('KTS Hub not found.');
    }
    return hub;
  }

  async listHubs(filters) {
    return hubsRepository.listHubs(filters);
  }

  async getNearbyHubs(query, actor = null) {
    let lat = query.latitude;
    let lng = query.longitude;

    if (lat === undefined || lng === undefined) {
      if (query.addressId) {
        const address = await hubsRepository.findAddressById(query.addressId);
        if (!address) {
          throw new NotFoundError('Specified addressId not found.');
        }
        if (address.latitude === null || address.longitude === null) {
          throw new BadRequestError('The specified address has no coordinates.');
        }
        lat = Number(address.latitude);
        lng = Number(address.longitude);
      } else if (actor?.id) {
        const defaultAddr = await hubsRepository.findDefaultAddressForUser(actor.id);
        if (defaultAddr && defaultAddr.latitude !== null && defaultAddr.longitude !== null) {
          lat = Number(defaultAddr.latitude);
          lng = Number(defaultAddr.longitude);
        }
      }
    }

    if (lat === undefined || lng === undefined) {
      throw new BadRequestError(
        'Geolocation coordinates required. Provide latitude/longitude, addressId, or save a default address.'
      );
    }

    const radiusKm = query.radiusKm || 25;
    const radiusMeters = radiusKm * 1000;

    const hubs = await hubsRepository.findNearbyHubs(lng, lat, radiusMeters);

    return {
      origin: {
        latitude: lat,
        longitude: lng,
      },
      radiusKm,
      count: hubs.length,
      hubs,
    };
  }

  async assignStaff(hubId, data, actor) {
    const hub = await hubsRepository.findHubById(hubId);
    if (!hub) {
      throw new NotFoundError('KTS Hub not found.');
    }

    await globalPolicyGuard.enforce({
      user: actor,
      action: 'CREATE',
      resource: 'STAFF_ASSIGNMENT',
      hubId,
    });

    return hubsRepository.assignStaff(hubId, data.userId, data.role, data.metadata);
  }

  async getStaff(hubId, actor) {
    const hub = await hubsRepository.findHubById(hubId);
    if (!hub) {
      throw new NotFoundError('KTS Hub not found.');
    }

    await globalPolicyGuard.enforce({
      user: actor,
      action: 'READ',
      resource: 'STAFF_ASSIGNMENT',
      hubId,
    });

    return hubsRepository.findStaffByHubId(hubId);
  }

  async removeStaff(hubId, staffId, actor) {
    const hub = await hubsRepository.findHubById(hubId);
    if (!hub) {
      throw new NotFoundError('KTS Hub not found.');
    }

    await globalPolicyGuard.enforce({
      user: actor,
      action: 'DELETE',
      resource: 'STAFF_ASSIGNMENT',
      hubId,
    });

    const removed = await hubsRepository.removeStaff(hubId, staffId);
    if (!removed) {
      throw new NotFoundError('Staff assignment not found for this hub.');
    }

    return {
      success: true,
      message: 'Staff assignment deactivated successfully.',
    };
  }
}

export const hubsService = new HubsService();
