import { BadRequestError, NotFoundError } from '../../core/errors/app.error.js';
import { invalidateAuthCache } from '../../core/middleware/auth.middleware.js';
import { authRepository } from '../auth/auth.repository.js';
import { authService } from '../auth/auth.service.js';
import {
  computeFarmerOnboardingState,
  formatBankAccount,
  formatDeliveryAddress,
} from '../auth/auth.utils.js';
import { profileRepository } from './profile.repository.js';

export class ProfileService {
  async getKycStatus(userId) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      user: authService.sanitizeUser(user),
      farmerProfile: user.farmerProfile,
      buyerProfile: user.buyerProfile,
      farmerOnboarding: computeFarmerOnboardingState(user),
    };
  }

  async updateBasicProfile(userId, sessionId, payload) {
    const updatedUser = await profileRepository.updateBasicProfile(userId, payload);
    if (!updatedUser) {
      throw new NotFoundError('User not found');
    }
    if (sessionId) {
      invalidateAuthCache(sessionId);
    }
    return {
      user: authService.sanitizeUser(updatedUser),
      buyerProfile: updatedUser.buyerProfile,
      farmerProfile: updatedUser.farmerProfile,
      farmerOnboarding: computeFarmerOnboardingState(updatedUser),
    };
  }

  async listBankAccounts(userId) {
    const accounts = await profileRepository.listBankAccounts(userId);
    return accounts.map(formatBankAccount);
  }

  async createBankAccount(userId, payload) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const accountHolderName = payload.accountHolderName || user.name || 'Farmer';
    const account = await profileRepository.createOrUpdateBankAccount(
      userId,
      {
        payoutChannel: payload.payoutChannel,
        accountHolderName,
        accountNumber: payload.accountNumber,
        ifscCode: payload.ifscCode,
        bankName: payload.bankName,
        branchName: payload.branchName,
        upiVpa: payload.upiVpa,
        metadata: {
          source: 'PROFILE_BANK_MANAGEMENT',
        },
      },
      payload.isDefault
    );

    return formatBankAccount(account);
  }

  async setDefaultBankAccount(userId, bankAccountId) {
    const updated = await profileRepository.setDefaultBankAccount(userId, bankAccountId);
    if (!updated) {
      throw new NotFoundError('Bank account not found');
    }
    return formatBankAccount(updated);
  }

  async deleteBankAccount(userId, bankAccountId) {
    const result = await profileRepository.deleteBankAccount(userId, bankAccountId);
    if (result.status === 'NOT_FOUND') {
      throw new NotFoundError('Bank account not found');
    }
    if (result.status === 'HAS_PAYOUTS') {
      throw new BadRequestError(
        'Cannot remove a bank account linked to historical settlements.'
      );
    }
    return { deleted: true, id: bankAccountId };
  }

  async listDeliveryAddresses(userId) {
    const rows = await profileRepository.listDeliveryAddresses(userId);
    return rows.map(formatDeliveryAddress);
  }

  async createDeliveryAddress(userId, payload) {
    const created = await profileRepository.createDeliveryAddress(userId, payload);
    return formatDeliveryAddress(created);
  }

  async updateDeliveryAddress(userId, addressId, payload) {
    const updated = await profileRepository.updateDeliveryAddress(
      userId,
      addressId,
      payload
    );
    if (!updated) {
      throw new NotFoundError('Address not found');
    }
    return formatDeliveryAddress(updated);
  }

  async setDefaultDeliveryAddress(userId, addressId) {
    const updated = await profileRepository.setDefaultDeliveryAddress(userId, addressId);
    if (!updated) {
      throw new NotFoundError('Address not found');
    }
    return formatDeliveryAddress(updated);
  }

  async deleteDeliveryAddress(userId, addressId) {
    const result = await profileRepository.deleteDeliveryAddress(userId, addressId);
    if (result.status === 'NOT_FOUND') {
      throw new NotFoundError('Address not found');
    }
    if (result.status === 'HAS_ORDERS') {
      throw new BadRequestError(
        'Cannot delete an address linked to existing orders.'
      );
    }
    return { deleted: true, id: addressId };
  }
}

export const profileService = new ProfileService();
