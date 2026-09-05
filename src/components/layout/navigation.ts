import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Boxes,
  Building2,
  ChartNoAxesCombined,
  FileStack,
  FileText,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  ScrollText,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
import type { Role } from '@/types';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Show a live count badge sourced from this key. */
  badge?: 'notifications' | 'pendingDocs' | 'pendingPayouts';
  end?: boolean;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const ADVISOR_NAV: NavGroup[] = [
  {
    label: null,
    items: [{ label: 'Dashboard', to: '/app/dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Pipeline',
    items: [
      { label: 'Leads', to: '/app/leads', icon: ListChecks, end: true },
      { label: 'Applications', to: '/app/applications', icon: FileStack },
      { label: 'Add New Lead', to: '/app/leads/new', icon: UserPlus },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Documents', to: '/app/documents', icon: FileText, badge: 'pendingDocs' },
      { label: 'Payouts', to: '/app/payouts', icon: Wallet },
      { label: 'Notifications', to: '/app/notifications', icon: Bell, badge: 'notifications' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Profile', to: '/app/profile', icon: UserRound },
      { label: 'Support', to: '/app/support', icon: LifeBuoy },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    label: null,
    items: [{ label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Pipeline',
    items: [
      { label: 'Leads', to: '/admin/leads', icon: ListChecks },
      { label: 'Applications', to: '/admin/applications', icon: FileStack },
      { label: 'Documents', to: '/admin/documents', icon: FileText, badge: 'pendingDocs' },
    ],
  },
  {
    label: 'Network',
    items: [
      { label: 'Advisors', to: '/admin/advisors', icon: Users },
      { label: 'Team / Staff', to: '/admin/team', icon: UsersRound },
      { label: 'Lenders & Partners', to: '/admin/lenders', icon: Handshake },
      { label: 'Products & Services', to: '/admin/products', icon: Boxes },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Payout Management', to: '/admin/payouts', icon: Wallet, badge: 'pendingPayouts' },
      { label: 'Reports', to: '/admin/reports', icon: ChartNoAxesCombined },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Notifications', to: '/admin/notifications', icon: Bell, badge: 'notifications' },
      { label: 'Organisation', to: '/admin/profile', icon: Building2 },
      { label: 'Audit Logs', to: '/admin/audit', icon: ScrollText },
    ],
  },
];

export const STAFF_NAV: NavGroup[] = [
  {
    label: null,
    items: [{ label: 'Assigned applications', to: '/staff/applications', icon: FileStack }],
  },
  {
    label: 'Account',
    items: [
      { label: 'Notifications', to: '/staff/notifications', icon: Bell, badge: 'notifications' },
    ],
  },
];

export function navFor(role: Role): NavGroup[] {
  if (role === 'admin') return ADMIN_NAV;
  if (role === 'staff') return STAFF_NAV;
  return ADVISOR_NAV;
}
