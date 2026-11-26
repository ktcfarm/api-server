import { hubsService } from './hubs.service.js';

export class HubsAdminController {
  async listHubs(req, res, next) {
    try {
      const result = await hubsService.listAdminHubs(req.query, req.user);
      res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async searchStaffCandidates(req, res, next) {
    try {
      const candidates = await hubsService.searchStaffCandidates(
        req.query,
        req.user
      );
      res.status(200).json({
        success: true,
        data: candidates,
      });
    } catch (error) {
      next(error);
    }
  }

  async getHubById(req, res, next) {
    try {
      const hub = await hubsService.getAdminHubById(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: hub,
      });
    } catch (error) {
      next(error);
    }
  }

  async createHub(req, res, next) {
    try {
      const hub = await hubsService.createHub(req.body, req.user);
      res.status(201).json({
        success: true,
        data: hub,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateHub(req, res, next) {
    try {
      const hub = await hubsService.updateHub(req.params.id, req.body, req.user);
      res.status(200).json({
        success: true,
        data: hub,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStaff(req, res, next) {
    try {
      const staff = await hubsService.getStaff(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }

  async assignStaff(req, res, next) {
    try {
      const assignment = await hubsService.assignStaff(
        req.params.id,
        req.body,
        req.user
      );
      res.status(201).json({
        success: true,
        data: assignment,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeStaff(req, res, next) {
    try {
      const result = await hubsService.removeStaff(
        req.params.id,
        req.params.staffId,
        req.user
      );
      res.status(200).json({
        success: true,
        data: {
          message: result.message,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async upsertFranchiseProfile(req, res, next) {
    try {
      const profile = await hubsService.upsertFranchiseProfile(
        req.params.id,
        req.body,
        req.user
      );
      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  async registerHubDocument(req, res, next) {
    try {
      const document = await hubsService.registerHubDocument(
        req.params.id,
        req.body,
        req.user
      );
      res.status(201).json({
        success: true,
        data: document,
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyHubDocument(req, res, next) {
    try {
      const document = await hubsService.verifyHubDocument(
        req.params.id,
        req.params.docId,
        req.body,
        req.user
      );
      res.status(200).json({
        success: true,
        data: document,
      });
    } catch (error) {
      next(error);
    }
  }

  async getHubDocumentUrl(req, res, next) {
    try {
      const result = await hubsService.getHubDocumentUrl(
        req.params.id,
        req.params.docId,
        req.user
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateOnboardingStatus(req, res, next) {
    try {
      const hub = await hubsService.updateOnboardingStatus(
        req.params.id,
        req.body,
        req.user
      );
      res.status(200).json({
        success: true,
        data: hub,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const hubsAdminController = new HubsAdminController();
