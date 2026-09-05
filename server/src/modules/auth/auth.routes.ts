import type { CookieOptions, Request } from 'express';
import { Router } from 'express';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { authRateLimiter, loginRateLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import {
  changePasswordSchema,
  createUserSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from './auth.schemas.js';
import {
  changePassword,
  createUser,
  login,
  logout,
  refresh,
  requestPasswordReset,
  resetPassword,
} from './auth.service.js';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.REFRESH_COOKIE_SAME_SITE,
  path: '/api/v1/auth',
};

const contextFrom = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip,
  userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
});

export const authRouter = Router();
authRouter.use(authRateLimiter);

authRouter.post('/login', loginRateLimiter, validate({ body: loginSchema }), async (req, res) => {
  const result = await login(loginSchema.parse(req.body), contextFrom(req));
  res.cookie(env.REFRESH_COOKIE_NAME, result.refreshToken, {
    ...cookieOptions,
    expires: result.refreshTokenExpiresAt,
  });
  const { refreshToken: _refreshToken, refreshTokenExpiresAt: _expiry, ...response } = result;
  void _refreshToken;
  void _expiry;
  res.json({ data: response });
});

authRouter.post('/refresh', async (req, res) => {
  const result = await refresh(req.cookies[env.REFRESH_COOKIE_NAME] as string | undefined, contextFrom(req));
  res.cookie(env.REFRESH_COOKIE_NAME, result.refreshToken, {
    ...cookieOptions,
    expires: result.refreshTokenExpiresAt,
  });
  const { refreshToken: _refreshToken, refreshTokenExpiresAt: _expiry, ...response } = result;
  void _refreshToken;
  void _expiry;
  res.json({ data: response });
});

authRouter.post('/logout', async (req, res) => {
  await logout(req.cookies[env.REFRESH_COOKIE_NAME] as string | undefined, contextFrom(req));
  res.clearCookie(env.REFRESH_COOKIE_NAME, cookieOptions);
  res.status(204).send();
});

authRouter.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema }),
  async (req, res) => {
    const input = forgotPasswordSchema.parse(req.body);
    const devResetToken = await requestPasswordReset(input.email, contextFrom(req));
    res.status(202).json({
      data: {
        message: 'If the account exists, password reset instructions will be sent.',
        ...(env.NODE_ENV === 'development' && devResetToken ? { devResetToken } : {}),
      },
    });
  },
);

authRouter.post('/reset-password', validate({ body: resetPasswordSchema }), async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  await resetPassword(input.token, input.newPassword, contextFrom(req));
  res.clearCookie(env.REFRESH_COOKIE_NAME, cookieOptions);
  res.json({ data: { message: 'Password reset successfully. Please sign in again.' } });
});

authRouter.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  async (req, res) => {
    const input = changePasswordSchema.parse(req.body);
    await changePassword(req.user!.id, input.currentPassword, input.newPassword, contextFrom(req));
    res.clearCookie(env.REFRESH_COOKIE_NAME, cookieOptions);
    res.json({ data: { message: 'Password changed successfully. Please sign in again.' } });
  },
);

authRouter.post(
  '/users',
  authenticate,
  requirePermission('users:create'),
  validate({ body: createUserSchema }),
  async (req, res) => {
    const user = await createUser(createUserSchema.parse(req.body), req.user!.id, contextFrom(req));
    res.status(201).json({ data: user });
  },
);
