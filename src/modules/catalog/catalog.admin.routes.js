import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware.js';
import { authorize } from '../../core/middleware/authorize.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { ACTIONS } from '../../core/rbac/actions.js';
import { catalogAdminController } from './catalog.admin.controller.js';
import {
  catalogIdParamsSchema,
  createCategorySchema,
  createCropSchema,
  createVarietySchema,
  listCategoriesSchema,
  listCropsSchema,
  listVarietiesSchema,
  updateCategorySchema,
  updateCropSchema,
  updateVarietySchema,
} from './catalog.validation.js';

const router = Router();

router.use(authMiddleware);

router.get(
  '/meta',
  authorize(ACTIONS.CROP.VIEW, 'CROP'),
  catalogAdminController.getMetadata.bind(catalogAdminController)
);

router.get(
  '/categories',
  authorize(ACTIONS.CROP.VIEW, 'CROP'),
  validate(listCategoriesSchema),
  catalogAdminController.listCategories.bind(catalogAdminController)
);

router.post(
  '/categories',
  authorize(ACTIONS.CROP.CREATE, 'CROP'),
  validate(createCategorySchema),
  catalogAdminController.createCategory.bind(catalogAdminController)
);

router.get(
  '/categories/:id',
  authorize(ACTIONS.CROP.VIEW, 'CROP'),
  validate(catalogIdParamsSchema),
  catalogAdminController.getCategoryById.bind(catalogAdminController)
);

router.patch(
  '/categories/:id',
  authorize(ACTIONS.CROP.UPDATE, 'CROP'),
  validate(updateCategorySchema),
  catalogAdminController.updateCategory.bind(catalogAdminController)
);

router.delete(
  '/categories/:id',
  authorize(ACTIONS.CROP.DELETE, 'CROP'),
  validate(catalogIdParamsSchema),
  catalogAdminController.deleteCategory.bind(catalogAdminController)
);

router.get(
  '/crops',
  authorize(ACTIONS.CROP.VIEW, 'CROP'),
  validate(listCropsSchema),
  catalogAdminController.listCrops.bind(catalogAdminController)
);

router.post(
  '/crops',
  authorize(ACTIONS.CROP.CREATE, 'CROP'),
  validate(createCropSchema),
  catalogAdminController.createCrop.bind(catalogAdminController)
);

router.get(
  '/crops/:id',
  authorize(ACTIONS.CROP.VIEW, 'CROP'),
  validate(catalogIdParamsSchema),
  catalogAdminController.getCropById.bind(catalogAdminController)
);

router.patch(
  '/crops/:id',
  authorize(ACTIONS.CROP.UPDATE, 'CROP'),
  validate(updateCropSchema),
  catalogAdminController.updateCrop.bind(catalogAdminController)
);

router.delete(
  '/crops/:id',
  authorize(ACTIONS.CROP.DELETE, 'CROP'),
  validate(catalogIdParamsSchema),
  catalogAdminController.deleteCrop.bind(catalogAdminController)
);

router.get(
  '/varieties',
  authorize(ACTIONS.CROP.VIEW, 'CROP'),
  validate(listVarietiesSchema),
  catalogAdminController.listVarieties.bind(catalogAdminController)
);

router.post(
  '/varieties',
  authorize(ACTIONS.CROP.CREATE, 'CROP'),
  validate(createVarietySchema),
  catalogAdminController.createVariety.bind(catalogAdminController)
);

router.get(
  '/varieties/:id',
  authorize(ACTIONS.CROP.VIEW, 'CROP'),
  validate(catalogIdParamsSchema),
  catalogAdminController.getVarietyById.bind(catalogAdminController)
);

router.patch(
  '/varieties/:id',
  authorize(ACTIONS.CROP.UPDATE, 'CROP'),
  validate(updateVarietySchema),
  catalogAdminController.updateVariety.bind(catalogAdminController)
);

router.delete(
  '/varieties/:id',
  authorize(ACTIONS.CROP.DELETE, 'CROP'),
  validate(catalogIdParamsSchema),
  catalogAdminController.deleteVariety.bind(catalogAdminController)
);

export const catalogAdminRouter = router;
