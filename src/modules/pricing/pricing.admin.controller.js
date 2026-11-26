import { pricingService } from './pricing.service.js';

export class PricingAdminController {
  async listRates(req, res, next) {
    try {
      const result = await pricingService.listRates(req.query, req.user);
      res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async resolveRate(req, res, next) {
    try {
      const resolved = await pricingService.resolveRateForAdmin(
        req.query,
        req.user
      );
      res.status(200).json({
        success: true,
        data: resolved,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRateById(req, res, next) {
    try {
      const rate = await pricingService.getRateById(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: rate,
      });
    } catch (error) {
      next(error);
    }
  }

  async createRate(req, res, next) {
    try {
      const rate = await pricingService.createRate(req.body, req.user);
      res.status(201).json({
        success: true,
        data: rate,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateRate(req, res, next) {
    try {
      const rate = await pricingService.updateRate(
        req.params.id,
        req.body,
        req.user
      );
      res.status(200).json({
        success: true,
        data: rate,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateRateStatus(req, res, next) {
    try {
      const rate = await pricingService.updateRateStatus(
        req.params.id,
        req.body.status,
        req.user
      );
      res.status(200).json({
        success: true,
        data: rate,
      });
    } catch (error) {
      next(error);
    }
  }

  async bulkUpsertRates(req, res, next) {
    try {
      const rates = await pricingService.bulkUpsertRates(
        req.body.items,
        req.user
      );
      res.status(200).json({
        success: true,
        data: rates,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const pricingAdminController = new PricingAdminController();
