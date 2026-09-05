import type { RequestUser } from '../../types/express.js';
import { badRequest, forbidden, notFound } from '../../common/errors.js';
import { prisma } from '../../lib/prisma.js';

export async function resolveAdvisorForWrite(user: RequestUser, requestedAdvisorId?: string) {
  if (user.advisorId) {
    if (requestedAdvisorId && requestedAdvisorId !== user.advisorId) {
      throw forbidden('Advisors cannot create records for another advisor');
    }
    return user.advisorId;
  }

  if (!requestedAdvisorId) {
    throw badRequest('advisorId is required for admin and staff users');
  }

  const advisor = await prisma.advisor.findUnique({
    where: { id: requestedAdvisorId },
    select: { id: true },
  });
  if (!advisor) throw notFound('Advisor not found');
  return advisor.id;
}

export function scopedAdvisorId(
  user: RequestUser,
  requestedAdvisorId: string | undefined,
  anyPermission: string,
) {
  if (user.permissions.includes(anyPermission)) {
    return requestedAdvisorId;
  }
  if (!user.advisorId) throw forbidden();
  return user.advisorId;
}
