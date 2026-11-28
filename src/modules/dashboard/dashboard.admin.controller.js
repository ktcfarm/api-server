import { dashboardService } from './dashboard.service.js';

export class DashboardAdminController {
  async getSummary(req, res, next) {
    try {
      const summary = await dashboardService.getSummary(req.query, req.user);
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardAdminController = new DashboardAdminController();
