import type { Prisma } from '../../../generated/prisma/client.js';
import { TERMINAL_APPLICATION_STATUSES } from '../../common/domain.js';
import { badRequest, conflict, notFound } from '../../common/errors.js';
import { hashPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import type { RequestUser } from '../../types/express.js';
import type { AuditContext } from '../audit/audit.service.js';
import { staffPermissions } from './staff-permissions.js';
import type {
  CreateStaffInput,
  StaffListQuery,
  StaffStatusInput,
  UpdateStaffInput,
} from './staff.schemas.js';

const staffInclude = {
  user: {
    include: {
      directPermissions: { include: { permission: true } },
      userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  },
  assignedApplications: { select: { status: true } },
  _count: { select: { assignmentHistory: true } },
} satisfies Prisma.StaffInclude;

type StaffRecord = Prisma.StaffGetPayload<{ include: typeof staffInclude }>;

function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

function serializeStaff(staff: StaffRecord) {
  const effectivePermissions = [
    ...new Set([
      ...staff.user.directPermissions.map(({ permission }) => permission.code),
      ...staff.user.userRoles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.code),
      ),
    ]),
  ].sort();
  const directPermissions = staff.user.directPermissions.map(({ permission }) => permission.code).sort();
  const { passwordHash: _password, directPermissions: _direct, userRoles: _roles, ...safeUser } = staff.user;
  void _password;
  void _direct;
  void _roles;
  return {
    id: staff.id,
    code: staff.code,
    department: staff.department,
    role: staff.role,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
    user: safeUser,
    status: staff.user.status,
    directPermissions,
    effectivePermissions: staff.user.userRoles.some(({ role }) => role.slug === 'admin')
      ? effectivePermissions
      : staffPermissions(staff.role),
    workload: {
      openApplications: staff.assignedApplications.filter(
        (application) => !TERMINAL_APPLICATION_STATUSES.has(application.status),
      ).length,
      currentApplications: staff.assignedApplications.length,
      totalAssignments: staff._count.assignmentHistory,
    },
  };
}

function auditData(user: RequestUser, context: AuditContext) {
  return {
    actorUserId: user.id,
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  };
}

async function permissionIds(codes: string[]) {
  const unique = [...new Set(codes)];
  const permissions = await prisma.permission.findMany({ where: { code: { in: unique } } });
  if (permissions.length !== unique.length) {
    const found = new Set(permissions.map((permission) => permission.code));
    throw badRequest('One or more permission codes do not exist', {
      unknown: unique.filter((code) => !found.has(code)),
    });
  }
  return permissions;
}

export async function listStaff(query: StaffListQuery) {
  const where: Prisma.StaffWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.department ? { department: { equals: query.department, mode: 'insensitive' } } : {}),
    ...(query.status ? { user: { status: query.status } } : {}),
    ...(query.dateFrom || query.dateTo
      ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search, mode: 'insensitive' } },
            { department: { contains: query.search, mode: 'insensitive' } },
            { user: { name: { contains: query.search, mode: 'insensitive' } } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
            { user: { mobile: { contains: query.search } } },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await prisma.$transaction([
    prisma.staff.findMany({ where, include: staffInclude, orderBy: { [query.sortBy]: query.sortOrder }, skip, take: query.pageSize }),
    prisma.staff.count({ where }),
  ]);
  return {
    items: items.map(serializeStaff),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };
}

export async function getStaff(id: string) {
  const staff = await prisma.staff.findUnique({ where: { id }, include: staffInclude });
  if (!staff) throw notFound('Staff member not found');
  return serializeStaff(staff);
}

export async function createStaff(
  input: CreateStaffInput,
  user: RequestUser,
  context: AuditContext,
) {
  const [role, permissions, passwordHash] = await Promise.all([
    prisma.role.findUnique({ where: { slug: 'staff' }, select: { id: true } }),
    permissionIds(input.permissionCodes),
    hashPassword(input.password),
  ]);
  if (!role) throw new Error('Staff role seed is missing');
  try {
    const staffId = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          mobile: normalizeMobile(input.mobile),
          passwordHash,
          userRoles: { create: { roleId: role.id } },
          directPermissions: {
            create: permissions.map((permission) => ({ permissionId: permission.id })),
          },
          staffProfile: {
            create: { code: input.code, department: input.department, role: input.role },
          },
        },
        select: { staffProfile: { select: { id: true } } },
      });
      const id = created.staffProfile!.id;
      await tx.auditLog.create({
        data: {
          ...auditData(user, context),
          action: 'STAFF_CREATED',
          entityType: 'staff',
          entityId: id,
          metadata: { code: input.code, role: input.role, permissionCodes: input.permissionCodes },
        },
      });
      return id;
    });
    return getStaff(staffId);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw conflict('Staff email, mobile, or code is already in use');
    }
    throw error;
  }
}

export async function updateStaff(
  id: string,
  input: UpdateStaffInput,
  user: RequestUser,
  context: AuditContext,
) {
  try {
    await prisma.$transaction(async (tx) => {
      const staff = await tx.staff.findUnique({ where: { id }, select: { userId: true } });
      if (!staff) throw notFound('Staff member not found');
      const userData: Prisma.UserUpdateInput = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.mobile !== undefined ? { mobile: normalizeMobile(input.mobile) } : {}),
      };
      if (Object.keys(userData).length) await tx.user.update({ where: { id: staff.userId }, data: userData });
      await tx.staff.update({
        where: { id },
        data: {
          ...(input.code !== undefined ? { code: input.code } : {}),
          ...(input.department !== undefined ? { department: input.department } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          ...auditData(user, context),
          action: 'STAFF_UPDATED',
          entityType: 'staff',
          entityId: id,
          metadata: { fields: Object.keys(input) },
        },
      });
    });
    return getStaff(id);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw conflict('Staff email, mobile, or code is already in use');
    }
    throw error;
  }
}

export async function updateStaffStatus(
  id: string,
  input: StaffStatusInput,
  user: RequestUser,
  context: AuditContext,
) {
  await prisma.$transaction(async (tx) => {
    const staff = await tx.staff.findUnique({ where: { id }, select: { userId: true, code: true } });
    if (!staff) throw notFound('Staff member not found');
    if (staff.userId === user.id && input.status !== 'ACTIVE') {
      throw conflict('You cannot deactivate or suspend your own account');
    }
    await tx.user.update({ where: { id: staff.userId }, data: { status: input.status } });
    if (input.status !== 'ACTIVE') {
      await tx.session.updateMany({ where: { userId: staff.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await tx.auditLog.create({
      data: {
        ...auditData(user, context),
        action: `STAFF_${input.status}`,
        entityType: 'staff',
        entityId: id,
        metadata: { code: staff.code, reason: input.reason },
      },
    });
  });
  return getStaff(id);
}

export async function replaceStaffPermissions(
  id: string,
  codes: string[],
  user: RequestUser,
  context: AuditContext,
) {
  const permissions = await permissionIds(codes);
  await prisma.$transaction(async (tx) => {
    const staff = await tx.staff.findUnique({ where: { id }, select: { userId: true } });
    if (!staff) throw notFound('Staff member not found');
    await tx.userPermission.deleteMany({ where: { userId: staff.userId } });
    if (permissions.length) {
      await tx.userPermission.createMany({
        data: permissions.map((permission) => ({ userId: staff.userId, permissionId: permission.id })),
      });
    }
    await tx.auditLog.create({
      data: {
        ...auditData(user, context),
        action: 'STAFF_PERMISSIONS_REPLACED',
        entityType: 'staff',
        entityId: id,
        metadata: { permissionCodes: [...new Set(codes)].sort() },
      },
    });
  });
  return getStaff(id);
}

export async function listPermissionCatalog() {
  return prisma.permission.findMany({ orderBy: { code: 'asc' }, select: { code: true, description: true } });
}
