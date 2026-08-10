import { daysAgo } from '@/lib/utils';
import type { StaffMember } from '@/types';

/**
 * Internal processing team. Kept in its own module because both the seeded
 * applications (which carry an assignee) and the org data import it.
 */
export const STAFF_MEMBERS: StaffMember[] = [
  {
    id: 'EMP-004',
    name: 'Ananya Iyer',
    code: 'OPS-004',
    email: 'admin@cibilon.in',
    mobile: '+91 98450 77120',
    role: 'Operations Manager',
    department: 'Operations',
    status: 'Active',
    joinedOn: daysAgo(760),
    avatarColor: 'bg-slate-800',
  },
  {
    id: 'EMP-011',
    name: 'Rahul Verma',
    code: 'CRD-011',
    email: 'rahul.verma@cibilon.in',
    mobile: '+91 99201 44873',
    role: 'Credit Analyst',
    department: 'Credit',
    status: 'Active',
    joinedOn: daysAgo(540),
    avatarColor: 'bg-brand-600',
  },
  {
    id: 'EMP-017',
    name: 'Sneha Pillai',
    code: 'VRF-017',
    email: 'sneha.pillai@cibilon.in',
    mobile: '+91 98330 21764',
    role: 'Verification Officer',
    department: 'Verification',
    status: 'Active',
    joinedOn: daysAgo(430),
    avatarColor: 'bg-indigo-600',
  },
  {
    id: 'EMP-023',
    name: 'Karan Bhatt',
    code: 'CRD-023',
    email: 'karan.bhatt@cibilon.in',
    mobile: '+91 97690 88251',
    role: 'Credit Analyst',
    department: 'Credit',
    status: 'Active',
    joinedOn: daysAgo(295),
    avatarColor: 'bg-teal-600',
  },
  {
    id: 'EMP-031',
    name: 'Divya Sethi',
    code: 'PAY-031',
    email: 'divya.sethi@cibilon.in',
    mobile: '+91 90040 11934',
    role: 'Payout Executive',
    department: 'Finance',
    status: 'Active',
    joinedOn: daysAgo(210),
    avatarColor: 'bg-violet-600',
  },
  {
    id: 'EMP-038',
    name: 'Nikhil Rao',
    code: 'RMG-038',
    email: 'nikhil.rao@cibilon.in',
    mobile: '+91 98861 55207',
    role: 'Relationship Manager',
    department: 'Partnerships',
    status: 'Active',
    joinedOn: daysAgo(160),
    avatarColor: 'bg-amber-600',
  },
  {
    id: 'EMP-044',
    name: 'Pooja Shetty',
    code: 'VRF-044',
    email: 'pooja.shetty@cibilon.in',
    mobile: '+91 99870 34418',
    role: 'Verification Officer',
    department: 'Verification',
    status: 'Inactive',
    joinedOn: daysAgo(88),
    avatarColor: 'bg-rose-600',
  },
];

/** Assignment rotation used when seeding applications. */
export const ASSIGNABLE_STAFF = STAFF_MEMBERS.filter((s) => s.status === 'Active');
