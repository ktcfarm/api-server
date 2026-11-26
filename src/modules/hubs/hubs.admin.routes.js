import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { hubsAdminController } from './hubs.admin.controller.js';
import {
  adminListHubsSchema,
  assignStaffSchema,
  createHubSchema,
  getHubParamsSchema,
  hubDocumentUrlParamsSchema,
  registerHubDocumentSchema,
  removeStaffSchema,
  staffCandidatesSchema,
  updateHubSchema,
  updateOnboardingStatusSchema,
  upsertFranchiseSchema,
  verifyHubDocumentSchema,
} from './hubs.validation.js';

const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  validate(adminListHubsSchema),
  hubsAdminController.listHubs.bind(hubsAdminController)
);

router.get(
  '/staff-candidates',
  validate(staffCandidatesSchema),
  hubsAdminController.searchStaffCandidates.bind(hubsAdminController)
);

router.post(
  '/',
  validate(createHubSchema),
  hubsAdminController.createHub.bind(hubsAdminController)
);

router.get(
  '/:id',
  validate(getHubParamsSchema),
  hubsAdminController.getHubById.bind(hubsAdminController)
);

router.patch(
  '/:id',
  validate(updateHubSchema),
  hubsAdminController.updateHub.bind(hubsAdminController)
);

router.get(
  '/:id/staff',
  validate(getHubParamsSchema),
  hubsAdminController.getStaff.bind(hubsAdminController)
);

router.post(
  '/:id/staff',
  validate(assignStaffSchema),
  hubsAdminController.assignStaff.bind(hubsAdminController)
);

router.delete(
  '/:id/staff/:staffId',
  validate(removeStaffSchema),
  hubsAdminController.removeStaff.bind(hubsAdminController)
);

router.put(
  '/:id/franchise',
  validate(upsertFranchiseSchema),
  hubsAdminController.upsertFranchiseProfile.bind(hubsAdminController)
);

router.post(
  '/:id/documents',
  validate(registerHubDocumentSchema),
  hubsAdminController.registerHubDocument.bind(hubsAdminController)
);

router.patch(
  '/:id/documents/:docId/verify',
  validate(verifyHubDocumentSchema),
  hubsAdminController.verifyHubDocument.bind(hubsAdminController)
);

router.get(
  '/:id/documents/:docId/url',
  validate(hubDocumentUrlParamsSchema),
  hubsAdminController.getHubDocumentUrl.bind(hubsAdminController)
);

router.patch(
  '/:id/onboarding-status',
  validate(updateOnboardingStatusSchema),
  hubsAdminController.updateOnboardingStatus.bind(hubsAdminController)
);

export const hubsAdminRouter = router;
