import crypto from 'node:crypto';

export const SUPPORTED_LANGUAGES = Object.freeze(['en', 'hi', 'mr', 'gu', 'kn', 'te']);

export const DEFAULT_USER_PREFERENCES = Object.freeze({
  instantOutbids: true,
  dailyMandiRateSms: true,
  weighbridgePayoutAlerts: true,
});

const LAND_SIZE_ACRES_MAP = Object.freeze({
  '< 2 acres': 1.5,
  '2–5 acres': 3.5,
  '2-5 acres': 3.5,
  '5–10 acres': 7.5,
  '5-10 acres': 7.5,
  '10+ acres': 12.0,
});

export function normalizeEmail(email) {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizePhone(phone) {
  if (typeof phone !== 'string') return null;
  const stripped = phone.replace(/[\s()-]/g, '').trim();
  if (!stripped) return null;

  if (/^[6-9]\d{9}$/.test(stripped)) {
    return `+91${stripped}`;
  }
  if (/^91[6-9]\d{9}$/.test(stripped)) {
    return `+${stripped}`;
  }
  if (/^\+[1-9]\d{7,14}$/.test(stripped)) {
    return stripped;
  }

  return null;
}

export function isValidNormalizedPhone(phone) {
  return normalizePhone(phone) !== null;
}

export function normalizeIdentifier(identifier, channel) {
  if (typeof identifier !== 'string') return '';
  const trimmed = identifier.trim();
  if (channel === 'EMAIL' || trimmed.includes('@')) {
    return normalizeEmail(trimmed) || trimmed.toLowerCase();
  }
  return normalizePhone(trimmed) || trimmed;
}

export function extractIdentifierCandidates(identifier) {
  if (typeof identifier !== 'string') return [];
  const trimmed = identifier.trim();
  const candidates = new Set([trimmed]);

  if (trimmed.includes('@')) {
    candidates.add(trimmed.toLowerCase());
  } else {
    const normalizedPhone = normalizePhone(trimmed);
    if (normalizedPhone) {
      candidates.add(normalizedPhone);
      if (normalizedPhone.startsWith('+91')) {
        candidates.add(normalizedPhone.slice(3));
      }
    }
  }

  return Array.from(candidates);
}

export function hashSha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function maskAadhaar(aadhaarDigits) {
  const digits = String(aadhaarDigits || '').replace(/\D/g, '');
  const last4 = digits.slice(-4);
  return {
    last4,
    masked: `XXXX-XXXX-${last4}`,
    hash: hashSha256(digits),
  };
}

export function maskAccountNumber(accountNumber) {
  if (!accountNumber) return null;
  const str = String(accountNumber).trim();
  if (str.length <= 4) return str;
  return `${'X'.repeat(Math.max(4, str.length - 4))}${str.slice(-4)}`;
}

export function mapLandSizeToAcres(landSizeRange, explicitAcres = null) {
  if (explicitAcres !== null && explicitAcres !== undefined && Number(explicitAcres) > 0) {
    return Number(explicitAcres);
  }
  if (typeof landSizeRange !== 'string') return null;
  const normalized = landSizeRange.trim().toLowerCase();
  if (LAND_SIZE_ACRES_MAP[normalized] !== undefined) {
    return LAND_SIZE_ACRES_MAP[normalized];
  }
  const numericMatch = normalized.match(/\d+(\.\d+)?/);
  return numericMatch ? Number(numericMatch[0]) : null;
}

export function formatUserPreferences(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    instantOutbids:
      typeof safe.instantOutbids === 'boolean'
        ? safe.instantOutbids
        : DEFAULT_USER_PREFERENCES.instantOutbids,
    dailyMandiRateSms:
      typeof safe.dailyMandiRateSms === 'boolean'
        ? safe.dailyMandiRateSms
        : DEFAULT_USER_PREFERENCES.dailyMandiRateSms,
    weighbridgePayoutAlerts:
      typeof safe.weighbridgePayoutAlerts === 'boolean'
        ? safe.weighbridgePayoutAlerts
        : DEFAULT_USER_PREFERENCES.weighbridgePayoutAlerts,
  };
}

export function formatBankAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    payoutChannel: account.payoutChannel,
    accountHolderName: account.accountHolderName,
    accountNumberMasked: maskAccountNumber(account.accountNumber),
    accountLast4: account.accountNumber ? account.accountNumber.slice(-4) : null,
    ifscCode: account.ifscCode,
    bankName: account.bankName,
    branchName: account.branchName,
    upiVpa: account.upiVpa,
    isVerified: account.isVerified,
    isDefault: account.isDefault,
    metadata: account.metadata || null,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export function formatAadhaarDocument(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    docType: doc.docType,
    maskedNumber: doc.docNumber,
    r2PrivateKey: doc.r2PrivateKey,
    status: doc.status,
    rejectionReason: doc.rejectionReason || null,
    providerMetadata: doc.providerMetadata || null,
    updatedAt: doc.updatedAt,
  };
}

export function formatDeliveryAddress(addr) {
  if (!addr) return null;
  const meta = addr.metadata && typeof addr.metadata === 'object' ? addr.metadata : {};
  return {
    id: addr.id,
    label: addr.label,
    isDefault: addr.isDefault,
    title: meta.title || addr.addressLine2 || addr.cityOrTown,
    facilityType: meta.facilityType || addr.label,
    bayShort: meta.bayShort || meta.facilityType || 'Front Door',
    contactName: addr.contactName,
    contactPhone: addr.contactPhone,
    altMobile: meta.altMobile || null,
    addressLine1: addr.addressLine1,
    addressLine2: addr.addressLine2 || null,
    landmark: addr.landmark || null,
    tehsilOrBlock: addr.tehsilOrBlock || null,
    cityOrTown: addr.cityOrTown,
    district: addr.district,
    state: addr.state,
    pinCode: addr.pinCode,
    country: addr.country || 'IN',
    latitude: addr.latitude !== null && addr.latitude !== undefined ? Number(addr.latitude) : null,
    longitude: addr.longitude !== null && addr.longitude !== undefined ? Number(addr.longitude) : null,
    hasWeighbridge: typeof meta.hasWeighbridge === 'boolean' ? meta.hasWeighbridge : false,
    supportsHeavyTruck:
      typeof meta.supportsHeavyTruck === 'boolean' ? meta.supportsHeavyTruck : false,
    requiresForklift:
      typeof meta.requiresForklift === 'boolean' ? meta.requiresForklift : false,
    metadata: meta,
    createdAt: addr.createdAt,
    updatedAt: addr.updatedAt,
  };
}

export function computeFarmerOnboardingState(user) {
  const roles = Array.isArray(user?.roles) ? user.roles.map((r) => r.role) : [];
  const hasFarmerRole = roles.includes('FARMER');
  const farmerProfile = user?.farmerProfile || null;
  const documents = Array.isArray(user?.documents) ? user.documents : [];
  const bankAccounts = Array.isArray(user?.bankAccounts) ? user.bankAccounts : [];

  const aadhaarDoc = documents.find((d) => d.docType === 'AADHAAR') || null;
  const identityCompleted = Boolean(aadhaarDoc || farmerProfile?.fatherName);
  const locationCompleted = Boolean(
    farmerProfile?.village &&
      farmerProfile?.district &&
      farmerProfile?.state &&
      farmerProfile?.pinCode
  );
  const payoutCompleted = bankAccounts.length > 0;

  let onboardingStep = farmerProfile?.onboardingStep || 'NOT_STARTED';
  if (identityCompleted && locationCompleted && payoutCompleted) {
    onboardingStep = 'COMPLETED';
  } else if (onboardingStep === 'NOT_STARTED' && identityCompleted) {
    onboardingStep = locationCompleted ? 'LOCATION' : 'IDENTITY';
  }

  let nextStep = null;
  if (onboardingStep !== 'COMPLETED') {
    if (!identityCompleted) {
      nextStep = 'IDENTITY';
    } else if (!locationCompleted) {
      nextStep = 'LOCATION';
    } else {
      nextStep = 'PAYOUT';
    }
  }

  return {
    hasFarmerRole,
    onboardingStep,
    isCompleted: onboardingStep === 'COMPLETED',
    nextStep,
    kycStatus: farmerProfile?.kycStatus || 'PENDING',
    steps: {
      identityCompleted,
      locationCompleted,
      payoutCompleted,
    },
  };
}
