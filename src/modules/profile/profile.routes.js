import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { profileController } from './profile.controller.js';
import {
  addressParamsSchema,
  bankAccountParamsSchema,
  createAddressSchema,
  createBankAccountSchema,
  updateAddressSchema,
  updateProfileSchema,
} from './profile.validation.js';

const router = Router();

router.use(authMiddleware);

router.get(
  '/kyc-status',
  profileController.getKycStatus.bind(profileController)
);

router.patch(
  '/',
  validate(updateProfileSchema),
  profileController.updateBasicProfile.bind(profileController)
);

router.get(
  '/bank-accounts',
  profileController.listBankAccounts.bind(profileController)
);

router.post(
  '/bank-accounts',
  validate(createBankAccountSchema),
  profileController.createBankAccount.bind(profileController)
);

router.patch(
  '/bank-accounts/:id/default',
  validate(bankAccountParamsSchema),
  profileController.setDefaultBankAccount.bind(profileController)
);

router.delete(
  '/bank-accounts/:id',
  validate(bankAccountParamsSchema),
  profileController.deleteBankAccount.bind(profileController)
);

router.get(
  '/addresses',
  profileController.listDeliveryAddresses.bind(profileController)
);

router.post(
  '/addresses',
  validate(createAddressSchema),
  profileController.createDeliveryAddress.bind(profileController)
);

router.patch(
  '/addresses/:id',
  validate(updateAddressSchema),
  profileController.updateDeliveryAddress.bind(profileController)
);

router.patch(
  '/addresses/:id/default',
  validate(addressParamsSchema),
  profileController.setDefaultDeliveryAddress.bind(profileController)
);

router.delete(
  '/addresses/:id',
  validate(addressParamsSchema),
  profileController.deleteDeliveryAddress.bind(profileController)
);

export const profileRouter = router;
