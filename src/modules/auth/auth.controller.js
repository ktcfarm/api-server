import { authService } from './auth.service.js';

export class AuthController {
  extractClientInfo(req) {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    return {
      ipAddress,
      deviceInfo: {
        userAgent,
        platform: req.headers['x-client-platform'] || 'UNKNOWN',
        appVersion: req.headers['x-app-version'] || '1.0.0',
      },
    };
  }

  async sendOtp(req, res, next) {
    try {
      const { identifier, channel, purpose } = req.body;
      const metadata = req.body.metadata || null;
      const result = await authService.sendOtp(identifier, channel, purpose, metadata);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async register(req, res, next) {
    try {
      const clientInfo = this.extractClientInfo(req);
      const result = await authService.register(req.body, clientInfo);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async loginWithPin(req, res, next) {
    try {
      const { identifier, pin, targetRole } = req.body;
      const clientInfo = this.extractClientInfo(req);
      const result = await authService.loginWithPin(identifier, pin, targetRole, clientInfo);

      if (result.requiresFarmerOnboarding) {
        return res.status(200).json({
          success: false,
          requiresFarmerOnboarding: true,
          message: result.message,
          userId: result.userId,
        });
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async loginWithOtp(req, res, next) {
    try {
      const { identifier, otp, targetRole } = req.body;
      const clientInfo = this.extractClientInfo(req);
      const result = await authService.loginWithOtp(identifier, otp, targetRole, clientInfo);

      if (result.requiresFarmerOnboarding) {
        return res.status(200).json({
          success: false,
          requiresFarmerOnboarding: true,
          message: result.message,
          userId: result.userId,
        });
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async onboardFarmer(req, res, next) {
    try {
      const userId = req.user.id;
      const sessionId = req.user.sessionId;
      const result = await authService.onboardFarmer(userId, req.body, sessionId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async resetPin(req, res, next) {
    try {
      const { identifier, otp, newPin } = req.body;
      const result = await authService.resetPin(identifier, otp, newPin);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const sessionId = req.user.sessionId;
      const result = await authService.logout(sessionId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async verifyIdentifier(req, res, next) {
    try {
      const userId = req.user.id;
      const { identifier, channel, otp } = req.body;
      const result = await authService.verifyIdentifier(userId, identifier, channel, otp);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      const { id: userId, activeRole, sessionId } = req.user;
      const result = await authService.getMe(userId, activeRole, sessionId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async switchRole(req, res, next) {
    try {
      const { id: userId, sessionId } = req.user;
      const { targetRole } = req.body;
      const result = await authService.switchRole(userId, sessionId, targetRole);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
