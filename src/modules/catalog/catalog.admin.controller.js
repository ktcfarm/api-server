import { catalogService } from './catalog.service.js';

export class CatalogAdminController {
  async getMetadata(req, res, next) {
    try {
      const data = await catalogService.getMetadata(req.user);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async listCategories(req, res, next) {
    try {
      const result = await catalogService.listCategories(req.query, req.user);
      res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCategoryById(req, res, next) {
    try {
      const category = await catalogService.getCategoryById(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req, res, next) {
    try {
      const category = await catalogService.createCategory(req.body, req.user, req.requestId);
      res.status(201).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req, res, next) {
    try {
      const category = await catalogService.updateCategory(
        req.params.id,
        req.body,
        req.user,
        req.requestId
      );
      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req, res, next) {
    try {
      const result = await catalogService.deleteCategory(req.params.id, req.user, req.requestId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async listCrops(req, res, next) {
    try {
      const result = await catalogService.listCrops(req.query, req.user);
      res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCropById(req, res, next) {
    try {
      const crop = await catalogService.getCropById(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: crop,
      });
    } catch (error) {
      next(error);
    }
  }

  async createCrop(req, res, next) {
    try {
      const crop = await catalogService.createCrop(req.body, req.user, req.requestId);
      res.status(201).json({
        success: true,
        data: crop,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCrop(req, res, next) {
    try {
      const crop = await catalogService.updateCrop(req.params.id, req.body, req.user, req.requestId);
      res.status(200).json({
        success: true,
        data: crop,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCrop(req, res, next) {
    try {
      const result = await catalogService.deleteCrop(req.params.id, req.user, req.requestId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async listVarieties(req, res, next) {
    try {
      const result = await catalogService.listVarieties(req.query, req.user);
      res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVarietyById(req, res, next) {
    try {
      const variety = await catalogService.getVarietyById(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: variety,
      });
    } catch (error) {
      next(error);
    }
  }

  async createVariety(req, res, next) {
    try {
      const variety = await catalogService.createVariety(req.body, req.user, req.requestId);
      res.status(201).json({
        success: true,
        data: variety,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateVariety(req, res, next) {
    try {
      const variety = await catalogService.updateVariety(
        req.params.id,
        req.body,
        req.user,
        req.requestId
      );
      res.status(200).json({
        success: true,
        data: variety,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteVariety(req, res, next) {
    try {
      const result = await catalogService.deleteVariety(req.params.id, req.user, req.requestId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const catalogAdminController = new CatalogAdminController();
