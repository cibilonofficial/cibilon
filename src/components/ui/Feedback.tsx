import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} />;
}

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      <div className="flex gap-4 bg-slate-50/80 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-3.5 flex-1', c === 0 && 'max-w-24')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="card-surface p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon}
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-800">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
