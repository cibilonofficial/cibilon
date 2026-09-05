import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  roles: string[];
  type: 'access';
}

export function signAccessToken(input: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign({ ...input, type: 'access' }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });

  if (
    typeof payload === 'string' ||
    payload.type !== 'access' ||
    typeof payload.sub !== 'string' ||
    typeof payload.sid !== 'string' ||
    !Array.isArray(payload.roles)
  ) {
    throw new Error('Invalid access token payload');
  }

  return payload as unknown as AccessTokenPayload;
}

export const generateOpaqueToken = () => randomBytes(48).toString('base64url');

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
