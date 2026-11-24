import { hubsService } from './hubs.service.js';

export class HubsController {
  async createHub(req, res, next) {
    try {
      const hub = await hubsService.createHub(req.body, req.user);
      res.status(201).json({ success: true, data: hub });
    } catch (error) {
      next(error);
    }
  }

  async updateHub(req, res, next) {
    try {
      const hub = await hubsService.updateHub(req.params.id, req.body, req.user);
      res.status(200).json({ success: true, data: hub });
    } catch (error) {
      next(error);
    }
  }

  async getHubById(req, res, next) {
    try {
      const hub = await hubsService.getHubById(req.params.id);
      res.status(200).json({ success: true, data: hub });
    } catch (error) {
      next(error);
    }
  }

  async listHubs(req, res, next) {
    try {
      const hubs = await hubsService.listHubs(req.query);
      res.status(200).json({ success: true, count: hubs.length, data: hubs });
    } catch (error) {
      next(error);
    }
  }

  async getNearbyHubs(req, res, next) {
    try {
      const result = await hubsService.getNearbyHubs(req.query, req.user || null);
      res.status(200).json({ success: true, ...result });
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
      res.status(201).json({ success: true, data: assignment });
    } catch (error) {
      next(error);
    }
  }

  async getStaff(req, res, next) {
    try {
      const staff = await hubsService.getStaff(req.params.id, req.user);
      res.status(200).json({ success: true, count: staff.length, data: staff });
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
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const hubsController = new HubsController();
