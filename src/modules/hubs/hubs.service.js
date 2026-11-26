import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../core/errors/app.error.js';
import { globalPolicyGuard } from '../../core/rbac/policy.guard.js';
import { storageProvider } from '../../core/storage/storage.factory.js';
import { hubsRepository } from './hubs.repository.js';
import { COMPULSORY_HUB_DOCUMENTS } from './hubs.validation.js';

export class HubsService {
  normalizeHubPayload(data, existingMetadata = null) {
    if (
      data.operatingHours === undefined ||
      data.operatingHours === null ||
      typeof data.operatingHours !== 'object'
    ) {
      return data;
    }

    const baseMetadata =
      data.metadata && typeof data.metadata === 'object'
        ? data.metadata
        : existingMetadata && typeof existingMetadata === 'object'
          ? existingMetadata
          : {};

    return {
      ...data,
      operatingHours: JSON.stringify(data.operatingHours),
      metadata: {
        ...baseMetadata,
        operatingHours: data.operatingHours,
      },
    };
  }

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

    return hubsRepository.createHub(this.normalizeHubPayload(data));
  }

  async updateHub(hubId, data, actor) {
    const hub = await hubsRepository.findHubById(hubId);
    if (!hub) {
      throw new NotFoundError('KTS Hub not found.');
    }

    const isAdmin = actor.activeRole
      ? actor.activeRole === 'SUPER_ADMIN' || actor.activeRole === 'ADMIN'
      : actor.roles.includes('SUPER_ADMIN') || actor.roles.includes('ADMIN');

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

    return hubsRepository.updateHub(
      hubId,
      this.normalizeHubPayload(data, hub.metadata)
    );
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

  async listAdminHubs(filters, actor) {
    await globalPolicyGuard.enforce({
      user: actor,
      action: 'READ',
      resource: 'HUB',
    });

    const userRoles = Array.isArray(actor.roles) ? actor.roles : [];
    const isSuperAdminHolder = userRoles.includes('SUPER_ADMIN');
    const effectiveRole = actor.activeRole;
    const hasGlobalHubVisibility =
      isSuperAdminHolder ||
      effectiveRole === 'SUPER_ADMIN' ||
      effectiveRole === 'ADMIN' ||
      (!effectiveRole && userRoles.includes('ADMIN'));

    let hubIds = null;
    if (!hasGlobalHubVisibility) {
      hubIds = (actor.staffAssignments || [])
        .filter((s) => s.isActive && (!effectiveRole || s.role === effectiveRole))
        .map((s) => s.hubId);

      if (hubIds.length === 0) {
        return {
          items: [],
          meta: {
            page: filters.page || 1,
            limit: filters.limit || 10,
            total: 0,
            totalPages: 1,
          },
        };
      }
    }

    const { items, total } = await hubsRepository.listAdminHubs({
      ...filters,
      hubIds,
    });

    const page = filters.page || 1;
    const limit = filters.limit || 10;

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getAdminHubById(hubId, actor) {
    const hub = await hubsRepository.findAdminHubById(hubId);
    if (!hub) {
      throw new NotFoundError('KTS Hub not found.');
    }

    await globalPolicyGuard.enforce({
      user: actor,
      action: 'READ',
      resource: 'HUB',
      hubId,
    });

    const { _count, ...rest } = hub;
    return {
      ...rest,
      activeStaffCount: _count?.staffAssignments ?? 0,
    };
  }

  async upsertFranchiseProfile(hubId, data, actor) {
    const hub = await hubsRepository.findHubById(hubId);
    if (!hub) {
      throw new NotFoundError('KTS Hub not found.');
    }

    await globalPolicyGuard.enforce({
      user: actor,
      action: 'UPDATE',
      resource: 'HUB',
      hubId,
      data: { restrictedFieldsPresent: true },
    });

    return hubsRepository.upsertFranchiseProfile(hubId, data);
  }

  async registerHubDocument(hubId, data, actor) {
    const hub = await hubsRepository.findHubById(hubId);
    if (!hub) {
      throw new NotFoundError('KTS Hub not found.');
    }

    await globalPolicyGuard.enforce({
      user: actor,
      action: 'UPDATE',
      resource: 'HUB',
      hubId,
      data: { restrictedFieldsPresent: true },
    });

    let parsedExpiryDate = null;
    if (data.expiryDate) {
      const candidate = new Date(data.expiryDate);
      if (Number.isNaN(candidate.getTime())) {
        throw new BadRequestError('Invalid expiryDate format.');
      }
      parsedExpiryDate = candidate;
    }

    return hubsRepository.upsertHubDocument(hubId, {
      ...data,
      expiryDate: parsedExpiryDate,
    });
  }

  async verifyHubDocument(hubId, docId, { status, rejectionReason }, actor) {
    const hub = await hubsRepository.findHubById(hubId);
    if (!hub) {
      throw new NotFoundError('KTS Hub not found.');
    }

    await globalPolicyGuard.enforce({
      user: actor,
      action: 'UPDATE',
      resource: 'HUB',
      hubId,
      data: { restrictedFieldsPresent: true },
    });

    const doc = await hubsRepository.findHubDocumentById(hubId, docId);
    if (!doc) {
      throw new NotFoundError('Hub compliance document not found.');
    }

    return hubsRepository.verifyHubDocument(doc.id, {
      verificationStatus: status,
      rejectionReason: status === 'REJECTED' ? rejectionReason : null,
      verifiedById: actor.id,
      verifiedAt: new Date(),
    });
  }

  async getHubDocumentUrl(hubId, docId, actor) {
    const hub = await hubsRepository.findHubById(hubId);
    if (!hub) {
      throw new NotFoundError('KTS Hub not found.');
    }

    await globalPolicyGuard.enforce({
      user: actor,
      action: 'READ',
      resource: 'HUB',
      hubId,
    });

    const doc = await hubsRepository.findHubDocumentById(hubId, docId);
    if (!doc) {
      throw new NotFoundError('Hub compliance document not found.');
    }

    const url = await storageProvider.getAccessUrl({
      key: doc.storageKey,
      bucketType: doc.bucketType,
      expiresInSeconds: 900,
    });

    return {
      url,
      key: doc.storageKey,
      bucketType: doc.bucketType,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
    };
  }

  async updateOnboardingStatus(hubId, { onboardingStatus, force = false }, actor) {
    const hub = await hubsRepository.findHubById(hubId);
    if (!hub) {
      throw new NotFoundError('KTS Hub not found.');
    }

    await globalPolicyGuard.enforce({
      user: actor,
      action: 'UPDATE',
      resource: 'HUB',
      hubId,
      data: { restrictedFieldsPresent: true },
    });

    if (onboardingStatus === 'VERIFIED') {
      const documents = await hubsRepository.findHubDocumentsByHubId(hubId);
      const presentTypes = new Set(documents.map((d) => d.documentType));
      const missingDocuments = COMPULSORY_HUB_DOCUMENTS.filter(
        (docType) => !presentTypes.has(docType)
      );

      const isSuperAdminActive =
        actor.activeRole === 'SUPER_ADMIN' ||
        (!actor.activeRole && actor.roles?.includes('SUPER_ADMIN'));

      if (missingDocuments.length > 0 && !(isSuperAdminActive && force)) {
        throw new BadRequestError(
          `Cannot mark hub VERIFIED. Missing compulsory compliance documents: ${missingDocuments.join(', ')}`,
          { missingDocuments }
        );
      }
    }

    return hubsRepository.updateOnboardingStatus(hubId, onboardingStatus);
  }

  async searchStaffCandidates(query, actor) {
    const userRoles = Array.isArray(actor.roles) ? actor.roles : [];
    const isSuperAdminHolder = userRoles.includes('SUPER_ADMIN');
    const effectiveRole = actor.activeRole;
    const isGlobalAdmin =
      effectiveRole === 'SUPER_ADMIN' ||
      effectiveRole === 'ADMIN' ||
      (!effectiveRole && (isSuperAdminHolder || userRoles.includes('ADMIN')));

    const canManageAsHubManager =
      effectiveRole === 'HUB_MANAGER' &&
      (isSuperAdminHolder ||
        (actor.staffAssignments || []).some(
          (s) => s.role === 'HUB_MANAGER' && s.isActive
        ));

    if (!isGlobalAdmin && !canManageAsHubManager) {
      throw new ForbiddenError(
        'Insufficient permissions to search staff candidates.'
      );
    }

    return hubsRepository.searchStaffCandidates(query.search, query.limit);
  }
}

export const hubsService = new HubsService();
