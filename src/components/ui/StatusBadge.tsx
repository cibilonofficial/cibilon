import {
  DOC_STATUS_TONES,
  LEAD_STAGE_TONES,
  LENDER_TONES,
  PAYOUT_TONES,
  PRIORITY_TONES,
  STATUS_TONES,
  TICKET_TONES,
} from '@/lib/constants';
import { cn } from '@/lib/utils';
import type {
  ApplicationStatus,
  DocumentStatus,
  LeadStage,
  LenderStatus,
  PayoutStatus,
  TicketPriority,
  TicketStatus,
} from '@/types';

const BASE =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset';

export function StatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  const tone = STATUS_TONES[status];
  return (
    <span className={cn(BASE, tone.badge, className)}>
      <span className={cn('size-1.5 rounded-full', tone.dot)} />
      {status}
    </span>
  );
}

export function DocStatusBadge({
  status,
  className,
}: {
  status: DocumentStatus;
  className?: string;
}) {
  const tone = DOC_STATUS_TONES[status];
  return (
    <span className={cn(BASE, tone.badge, className)}>
      <span className={cn('size-1.5 rounded-full', tone.dot)} />
      {status}
    </span>
  );
}

export function PayoutBadge({ status, className }: { status: PayoutStatus; className?: string }) {
  const tone = PAYOUT_TONES[status];
  return (
    <span className={cn(BASE, tone.badge, className)}>
      <span className={cn('size-1.5 rounded-full', tone.dot)} />
      {status}
    </span>
  );
}

export function LeadStageBadge({ stage, className }: { stage: LeadStage; className?: string }) {
  const tone = LEAD_STAGE_TONES[stage];
  return (
    <span className={cn(BASE, tone.badge, className)}>
      <span className={cn('size-1.5 rounded-full', tone.dot)} />
      {stage}
    </span>
  );
}

export function LenderBadge({ status, className }: { status: LenderStatus; className?: string }) {
  const tone = LENDER_TONES[status];
  return (
    <span className={cn(BASE, tone.badge, className)}>
      <span className={cn('size-1.5 rounded-full', tone.dot)} />
      {status}
    </span>
  );
}

export function TicketBadge({ status, className }: { status: TicketStatus; className?: string }) {
  const tone = TICKET_TONES[status];
  return (
    <span className={cn(BASE, tone.badge, className)}>
      <span className={cn('size-1.5 rounded-full', tone.dot)} />
      {status}
    </span>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) {
  const tone = PRIORITY_TONES[priority];
  return (
    <span className={cn(BASE, tone.badge, className)}>
      <span className={cn('size-1.5 rounded-full', tone.dot)} />
      {priority}
    </span>
  );
}

export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'brand' | 'money' | 'warn' | 'danger';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
    money: 'bg-money-50 text-money-700 ring-money-500/25',
    warn: 'bg-amber-50 text-amber-700 ring-amber-200',
    danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  } as const;
  return <span className={cn(BASE, tones[tone], className)}>{children}</span>;
}
