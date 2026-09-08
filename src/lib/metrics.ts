import { STATUS_TONES } from './constants';
import type { AppDocument, Application, ApplicationStatus, Payout } from '@/types';

export const ACTIVE_STATUSES: ApplicationStatus[] = [
  'Submitted',
  'Under Review',
  'Documents Required',
  'Processing',
  'Submitted to Lender',
  'Additional Information Required',
];

export const APPROVED_STATUSES: ApplicationStatus[] = ['Approved', 'Disbursed', 'Completed'];
export const COMPLETED_STATUSES: ApplicationStatus[] = ['Disbursed', 'Completed'];

export const ADVISOR_ACTION_DOC_STATUSES = ['Pending', 'Re-upload Required', 'Rejected'] as const;

export interface Metrics {
  totalLeads: number;
  active: number;
  approved: number;
  completed: number;
  rejected: number;
  drafts: number;
  pendingDocuments: number;
  totalPayout: number;
  pendingPayout: number;
  paidPayout: number;
  thisMonthPayout: number;
  disbursedVolume: number;
  approvalRate: number;
}

export function computeMetrics(
  applications: Application[],
  documents: AppDocument[],
  payouts: Payout[],
): Metrics {
  const ids = new Set(applications.map((a) => a.id));
  const scopedDocs = documents.filter((d) => ids.has(d.applicationId));
  const scopedPayouts = payouts.filter((p) => ids.has(p.applicationId));

  const decided = applications.filter((a) =>
    ['Approved', 'Rejected', 'Disbursed', 'Completed'].includes(a.status),
  );
  const approved = decided.filter((a) => a.status !== 'Rejected');

  const month = new Date().getMonth();
  const year = new Date().getFullYear();

  return {
    totalLeads: applications.length,
    active: applications.filter((a) => ACTIVE_STATUSES.includes(a.status)).length,
    approved: applications.filter((a) => APPROVED_STATUSES.includes(a.status)).length,
    completed: applications.filter((a) => COMPLETED_STATUSES.includes(a.status)).length,
    rejected: applications.filter((a) => a.status === 'Rejected').length,
    drafts: applications.filter((a) => a.status === 'Draft').length,
    pendingDocuments: scopedDocs.filter((d) =>
      (ADVISOR_ACTION_DOC_STATUSES as readonly string[]).includes(d.status),
    ).length,
    totalPayout: scopedPayouts.reduce((sum, p) => sum + p.payoutAmount, 0),
    pendingPayout: scopedPayouts
      .filter((p) => p.status !== 'Paid')
      .reduce((sum, p) => sum + p.payoutAmount, 0),
    paidPayout: scopedPayouts
      .filter((p) => p.status === 'Paid')
      .reduce((sum, p) => sum + p.payoutAmount, 0),
    thisMonthPayout: scopedPayouts
      .filter((p) => {
        const date = p.paymentDate ?? p.disbursementDate;
        if (!date) return false;
        const d = new Date(date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, p) => sum + p.payoutAmount, 0),
    disbursedVolume: applications
      .filter((a) => COMPLETED_STATUSES.includes(a.status))
      .reduce((sum, a) => sum + a.loanAmount, 0),
    approvalRate: decided.length ? Math.round((approved.length / decided.length) * 100) : 0,
  };
}

export function statusDistribution(applications: Application[]) {
  const counts = new Map<ApplicationStatus, number>();
  applications.forEach((a) => counts.set(a.status, (counts.get(a.status) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, value]) => ({
      name: status,
      value,
      color: STATUS_TONES[status].hex,
    }));
}

const SERVICE_COLORS = [
  '#1e4a8a',
  '#2b5fa8',
  '#4b7fc4',
  '#2fa27a',
  '#0ea5e9',
  '#8b5cf6',
  '#f59e0b',
  '#64748b',
];

export function serviceDistribution(applications: Application[]) {
  const counts = new Map<string, number>();
  applications.forEach((a) => counts.set(a.service, (counts.get(a.service) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: SERVICE_COLORS[i % SERVICE_COLORS.length] }));
}

export function advisorRollup(
  advisorId: string,
  applications: Application[],
  payouts: Payout[],
) {
  const mine = applications.filter((a) => a.advisorId === advisorId);
  const minePayouts = payouts.filter((p) => p.advisorId === advisorId);
  return {
    totalLeads: mine.length,
    active: mine.filter((a) => ACTIVE_STATUSES.includes(a.status)).length,
    completed: mine.filter((a) => COMPLETED_STATUSES.includes(a.status)).length,
    rejected: mine.filter((a) => a.status === 'Rejected').length,
    totalPayout: minePayouts.reduce((sum, p) => sum + p.payoutAmount, 0),
    pendingPayout: minePayouts
      .filter((p) => p.status !== 'Paid')
      .reduce((sum, p) => sum + p.payoutAmount, 0),
  };
}

/** Six calendar months derived from API-backed application and payout records. */
export function monthlyTrend(applications: Application[], payouts: Payout[]) {
  const now = new Date();
  const rows = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - offset), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      month: date.toLocaleDateString('en-IN', { month: 'short' }),
      submitted: 0,
      disbursed: 0,
      payout: 0,
    };
  });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  applications.forEach((application) => {
    const created = new Date(application.createdAt);
    const submitted = byKey.get(`${created.getFullYear()}-${created.getMonth()}`);
    if (submitted) submitted.submitted += 1;
    if (COMPLETED_STATUSES.includes(application.status)) {
      const closed = new Date(application.updatedAt);
      const row = byKey.get(`${closed.getFullYear()}-${closed.getMonth()}`);
      if (row) row.disbursed += 1;
    }
  });
  payouts.forEach((payout) => {
    const iso = payout.paymentDate ?? payout.disbursementDate;
    if (!iso) return;
    const date = new Date(iso);
    const row = byKey.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (row) row.payout += payout.payoutAmount;
  });
  return rows.map(({ key: _key, ...row }) => row);
}
