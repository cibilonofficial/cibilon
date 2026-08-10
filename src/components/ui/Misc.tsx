import type { ReactNode } from 'react';
import { cn, initials } from '@/lib/utils';

export function Avatar({
  name,
  color = 'bg-brand-600',
  src,
  size = 'md',
  className,
}: {
  name: string;
  color?: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizes = {
    sm: 'size-7 text-[11px]',
    md: 'size-9 text-xs',
    lg: 'size-11 text-sm',
    xl: 'size-20 text-xl',
  };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('shrink-0 rounded-full object-cover', sizes[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        color,
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {breadcrumb}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto border-b border-slate-200 scrollbar-none', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
              isActive
                ? 'border-brand-700 text-brand-900'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'tnum rounded px-1.5 py-0.5 text-[11px] font-semibold',
                  isActive ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-500',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Small labelled progress bar used for document completeness. */
export function ProgressBar({
  value,
  max = 100,
  label,
  tone = 'brand',
}: {
  value: number;
  max?: number;
  label?: ReactNode;
  tone?: 'brand' | 'money' | 'warn';
}) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const tones = {
    brand: 'bg-brand-600',
    money: 'bg-money-500',
    warn: 'bg-amber-500',
  };
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          {label}
          <span className="tnum font-medium text-slate-700">{pct}%</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', tones[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
        {children}
      </h3>
      {action}
    </div>
  );
}
