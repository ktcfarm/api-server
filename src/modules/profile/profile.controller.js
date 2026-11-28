import { profileService } from './profile.service.js';

export class ProfileController {
  async getKycStatus(req, res, next) {
    try {
      const result = await profileService.getKycStatus(req.user.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateBasicProfile(req, res, next) {
    try {
      const result = await profileService.updateBasicProfile(
        req.user.id,
        req.user.sessionId,
        req.body
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async listBankAccounts(req, res, next) {
    try {
      const accounts = await profileService.listBankAccounts(req.user.id);
      res.status(200).json({ success: true, data: accounts });
    } catch (error) {
      next(error);
    }
  }

  async createBankAccount(req, res, next) {
    try {
      const account = await profileService.createBankAccount(req.user.id, req.body);
      res.status(201).json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  }

  async setDefaultBankAccount(req, res, next) {
    try {
      const account = await profileService.setDefaultBankAccount(
        req.user.id,
        req.params.id
      );
      res.status(200).json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  }

  async deleteBankAccount(req, res, next) {
    try {
      const result = await profileService.deleteBankAccount(req.user.id, req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async listDeliveryAddresses(req, res, next) {
    try {
      const addresses = await profileService.listDeliveryAddresses(req.user.id);
      res.status(200).json({ success: true, data: addresses });
    } catch (error) {
      next(error);
    }
  }

  async createDeliveryAddress(req, res, next) {
    try {
      const address = await profileService.createDeliveryAddress(req.user.id, req.body);
      res.status(201).json({ success: true, data: address });
    } catch (error) {
      next(error);
    }
  }

  async updateDeliveryAddress(req, res, next) {
    try {
      const address = await profileService.updateDeliveryAddress(
        req.user.id,
        req.params.id,
        req.body
      );
      res.status(200).json({ success: true, data: address });
    } catch (error) {
      next(error);
    }
  }

  async setDefaultDeliveryAddress(req, res, next) {
    try {
      const address = await profileService.setDefaultDeliveryAddress(
        req.user.id,
        req.params.id
      );
      res.status(200).json({ success: true, data: address });
    } catch (error) {
      next(error);
    }
  }

  async deleteDeliveryAddress(req, res, next) {
    try {
      const result = await profileService.deleteDeliveryAddress(
        req.user.id,
        req.params.id
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const profileController = new ProfileController();
