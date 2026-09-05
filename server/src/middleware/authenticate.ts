import type { RequestHandler } from 'express';
import { unauthorized } from '../common/errors.js';
import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { getUserIdentity } from '../modules/users/user-identity.js';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    next(unauthorized());
    return;
  }

  try {
    const payload = verifyAccessToken(authorization.slice(7));
    const session = await prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    const identity = session ? await getUserIdentity(payload.sub) : null;

    if (!session || !identity || identity.status !== 'ACTIVE') {
      next(unauthorized('Your session is no longer active'));
      return;
    }

    req.user = { ...identity, sessionId: session.id };
    next();
  } catch {
    next(unauthorized('Access token is invalid or expired'));
  }
};
