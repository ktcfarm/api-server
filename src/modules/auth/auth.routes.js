import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware.js';
import {
  authRateLimiter,
  otpRateLimiter,
} from '../../core/middleware/rate-limit.middleware.js';
import { validate } from '../../core/middleware/validate.middleware.js';
import { authController } from './auth.controller.js';
import {
  farmerOnboardingSchema,
  loginOtpSchema,
  loginPinSchema,
  refreshTokenSchema,
  registerSchema,
  resetPinSchema,
  sendOtpSchema,
  verifyIdentifierSchema,
} from './auth.validation.js';

const router = Router();

router.post(
  '/otp/send',
  otpRateLimiter,
  validate(sendOtpSchema),
  authController.sendOtp.bind(authController)
);

router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  authController.register.bind(authController)
);

router.post(
  '/login/pin',
  authRateLimiter,
  validate(loginPinSchema),
  authController.loginWithPin.bind(authController)
);

router.post(
  '/login/otp',
  otpRateLimiter,
  validate(loginOtpSchema),
  authController.loginWithOtp.bind(authController)
);

router.post(
  '/onboarding/farmer',
  authMiddleware,
  validate(farmerOnboardingSchema),
  authController.onboardFarmer.bind(authController)
);

router.post(
  '/pin/reset',
  authRateLimiter,
  validate(resetPinSchema),
  authController.resetPin.bind(authController)
);

router.post(
  '/token/refresh',
  validate(refreshTokenSchema),
  authController.refreshToken.bind(authController)
);

router.post(
  '/logout',
  authMiddleware,
  authController.logout.bind(authController)
);

router.post(
  '/verify-identifier',
  authMiddleware,
  validate(verifyIdentifierSchema),
  authController.verifyIdentifier.bind(authController)
);

router.get(
  '/me',
  authMiddleware,
  authController.getMe.bind(authController)
);

export const authRouter = router;
