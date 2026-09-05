import { prisma } from '../../lib/prisma.js';
import { staffPermissions } from '../staff/staff-permissions.js';

export async function getUserIdentity(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
      directPermissions: { include: { permission: true } },
      advisorProfile: true,
      staffProfile: true,
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    status: user.status,
    roles: user.userRoles.map(({ role }) => role.slug),
    permissions: user.staffProfile && !user.userRoles.some(({ role }) => role.slug === 'admin')
      ? staffPermissions(user.staffProfile.role)
      : [
      ...new Set(
        [
          ...user.userRoles.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.code),
          ),
          ...user.directPermissions.map(({ permission }) => permission.code),
        ],
      ),
    ],
    advisorId: user.advisorProfile?.id ?? null,
    staffId: user.staffProfile?.id ?? null,
    code: user.advisorProfile?.code ?? user.staffProfile?.code ?? null,
    agency: user.advisorProfile?.agency ?? null,
    department: user.staffProfile?.department ?? null,
  };
}
