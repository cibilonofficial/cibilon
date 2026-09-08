import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  /** Signed percentage; positive renders green, negative renders red. */
  delta?: number;
  lowerIsBetter?: boolean;
  deltaLabel?: string;
  footnote?: ReactNode;
  tone?: 'neutral' | 'brand' | 'money' | 'warn' | 'danger' | 'info';
  onClick?: () => void;
}

const ICON_TONES = {
  neutral: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-50 text-brand-700',
  money: 'bg-money-50 text-money-700',
  warn: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-sky-50 text-sky-700',
} as const;

export function StatCard({
  label,
  value,
  icon,
  delta,
  lowerIsBetter = false,
  deltaLabel,
  footnote,
  tone = 'neutral',
  onClick,
}: StatCardProps) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'card-surface w-full p-5 text-left transition-all duration-200',
        onClick && 'hover:-translate-y-1 hover:shadow-raised focus-visible:shadow-raised',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-2xl',
            ICON_TONES[tone],
          )}
        >
          {icon}
        </span>
      </div>

      <p className="tnum mt-2.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>

      {(delta !== undefined || footnote) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {delta !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded font-medium',
                delta === 0 ? 'text-slate-500' : ((delta > 0) !== lowerIsBetter ? 'text-money-700' : 'text-rose-600'),
              )}
            >
              {delta === 0 ? null : delta > 0 ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownRight className="size-3.5" />
              )}
              {Math.abs(delta)}%
            </span>
          )}
          <span className="text-slate-500">{deltaLabel ?? footnote}</span>
        </div>
      )}
    </Wrapper>
  );
}
