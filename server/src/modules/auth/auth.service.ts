import bcrypt from 'bcryptjs';
import { AppError, conflict, forbidden, unauthorized } from '../../common/errors.js';
import { env } from '../../config/env.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { generateOpaqueToken, hashToken, signAccessToken } from '../../lib/tokens.js';
import { writeAudit, type AuditContext } from '../audit/audit.service.js';
import { getUserIdentity } from '../users/user-identity.js';
import type { CreateUserInput, LoginInput } from './auth.schemas.js';

const dummyPasswordHash = bcrypt.hashSync('Never-A-Real-Credential-42!', 12);

function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

function sessionExpiresAt(remember: boolean) {
  const days = remember ? env.REFRESH_TOKEN_TTL_DAYS : 1;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function issueSession(
  userId: string,
  roles: string[],
  remember: boolean,
  context: AuditContext,
) {
  const refreshToken = generateOpaqueToken();
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      persistent: remember,
      expiresAt: sessionExpiresAt(remember),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
  return {
    accessToken: signAccessToken({ sub: userId, sid: session.id, roles }),
    refreshToken,
    accessTokenExpiresIn: env.JWT_ACCESS_TTL_SECONDS,
    refreshTokenExpiresAt: session.expiresAt,
  };
}

export async function login(input: LoginInput, context: AuditContext) {
  const identifier = input.identifier.trim();
  const isEmail = identifier.includes('@');
  const user = await prisma.user.findFirst({
    where: isEmail
      ? { email: identifier.toLowerCase() }
      : { mobile: normalizeMobile(identifier) },
    select: { id: true, passwordHash: true, status: true },
  });

  const passwordMatches = await verifyPassword(input.password, user?.passwordHash ?? dummyPasswordHash);
  if (!user || !passwordMatches) {
    await writeAudit({
      ...context,
      actorUserId: user?.id,
      action: 'LOGIN_FAILED',
      entityType: 'auth',
      entityId: user?.id,
      metadata: { reason: 'invalid_credentials' },
    });
    throw unauthorized('Invalid email/mobile number or password');
  }

  if (user.status !== 'ACTIVE') {
    await writeAudit({
      ...context,
      actorUserId: user.id,
      action: 'LOGIN_BLOCKED',
      entityType: 'auth',
      entityId: user.id,
      metadata: { reason: 'account_not_active' },
    });
    throw forbidden('This account is not active');
  }

  const identity = await getUserIdentity(user.id);
  if (!identity) throw unauthorized();
  const tokens = await issueSession(user.id, identity.roles, input.remember, context);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({
    ...context,
    actorUserId: user.id,
    action: 'LOGIN_SUCCEEDED',
    entityType: 'auth',
    entityId: user.id,
  });

  return { user: identity, ...tokens };
}

export async function refresh(rawToken: string | undefined, context: AuditContext) {
  if (!rawToken) throw unauthorized('Refresh token is missing');
  const tokenHash = hashToken(rawToken);
  const current = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, status: true } } },
  });

  if (
    !current ||
    current.revokedAt ||
    current.expiresAt <= new Date() ||
    current.user.status !== 'ACTIVE'
  ) {
    throw unauthorized('Refresh token is invalid or expired');
  }

  const identity = await getUserIdentity(current.user.id);
  if (!identity) throw unauthorized();

  const nextRefreshToken = generateOpaqueToken();
  const nextExpiry = sessionExpiresAt(current.persistent);
  const nextSession = await prisma.$transaction(async (tx) => {
    const revoked = await tx.session.updateMany({
      where: { id: current.id, revokedAt: null },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });
    if (revoked.count !== 1) throw unauthorized('Refresh token has already been used');
    return tx.session.create({
      data: {
        userId: current.user.id,
        tokenHash: hashToken(nextRefreshToken),
        persistent: current.persistent,
        expiresAt: nextExpiry,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  });

  await writeAudit({
    ...context,
    actorUserId: current.user.id,
    action: 'SESSION_REFRESHED',
    entityType: 'session',
    entityId: nextSession.id,
  });

  return {
    user: identity,
    accessToken: signAccessToken({
      sub: current.user.id,
      sid: nextSession.id,
      roles: identity.roles,
    }),
    refreshToken: nextRefreshToken,
    accessTokenExpiresIn: env.JWT_ACCESS_TTL_SECONDS,
    refreshTokenExpiresAt: nextSession.expiresAt,
  };
}

export async function logout(rawToken: string | undefined, context: AuditContext) {
  if (!rawToken) return;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { id: true, userId: true },
  });
  if (!session) return;
  await prisma.session.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await writeAudit({
    ...context,
    actorUserId: session.userId,
    action: 'LOGOUT',
    entityType: 'session',
    entityId: session.id,
  });
}

export async function requestPasswordReset(email: string, context: AuditContext) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.status !== 'ACTIVE') return null;

  const rawToken = generateOpaqueToken();
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    }),
  ]);
  await writeAudit({
    ...context,
    actorUserId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    entityType: 'user',
    entityId: user.id,
  });
  return rawToken;
}

export async function resetPassword(rawToken: string, newPassword: string, context: AuditContext) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'Password reset token is invalid or expired');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'Password reset token is invalid or expired');
    }
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
  await writeAudit({
    ...context,
    actorUserId: record.userId,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'user',
    entityId: record.userId,
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  context: AuditContext,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError(400, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect');
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new AppError(400, 'PASSWORD_REUSED', 'New password must be different from current password');
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  await writeAudit({
    ...context,
    actorUserId: userId,
    action: 'PASSWORD_CHANGED',
    entityType: 'user',
    entityId: userId,
  });
}

export async function createUser(input: CreateUserInput, actor: string, context: AuditContext) {
  const roles = await prisma.role.findMany({ where: { slug: { in: input.roleSlugs } } });
  if (roles.length !== new Set(input.roleSlugs).size) {
    throw new AppError(400, 'INVALID_ROLE', 'One or more roles do not exist');
  }
  const passwordHash = await hashPassword(input.password);
  const hasAdvisorRole = input.roleSlugs.includes('advisor');
  const hasStaffRole = input.roleSlugs.includes('staff');

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        mobile: input.mobile ? normalizeMobile(input.mobile) : null,
        passwordHash,
        userRoles: { create: roles.map((role) => ({ roleId: role.id })) },
        ...(hasAdvisorRole
          ? { advisorProfile: { create: { code: input.code!, agency: input.agency } } }
          : {}),
        ...(hasStaffRole
          ? { staffProfile: { create: { code: input.code!, department: input.department } } }
          : {}),
      },
      select: { id: true },
    });
    await writeAudit({
      ...context,
      actorUserId: actor,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: user.id,
      metadata: { roles: input.roleSlugs },
    });
    return getUserIdentity(user.id);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw conflict('Email, mobile number, or identity code is already in use');
    }
    throw error;
  }
}
