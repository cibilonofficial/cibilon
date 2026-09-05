import type { StaffRole } from '../../../generated/prisma/client.js';

export const STAFF_BASE_PERMISSIONS = [
  'applications:read:any', 'documents:read:any', 'lenders:read', 'products:read',
];
const notes = ['applications:remarks:create', 'applications:activity:create'];
const processing = [...notes, 'applications:status:update', 'documents:request'];
const verification = [...notes, 'documents:request', 'documents:verify'];
export const STAFF_ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
  OPERATIONS_MANAGER: [...new Set([...processing, ...verification])],
  CREDIT_ANALYST: processing,
  VERIFICATION_OFFICER: verification,
  PAYOUT_EXECUTIVE: notes,
  RELATIONSHIP_MANAGER: notes,
};

/** Enforced at every authenticated request, including legacy staff accounts. */
export function staffPermissions(role: StaffRole) {
  return [...STAFF_BASE_PERMISSIONS, ...STAFF_ROLE_PERMISSIONS[role]];
}
