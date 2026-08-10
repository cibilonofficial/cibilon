import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-900',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <path d="M5 17V7h2.6v7.6H12V17H5Z" fill="#ffffff" />
        <rect x="14.4" y="7" width="2.6" height="10" rx="0.4" fill="#2fa27a" />
        <rect x="18.4" y="10" width="2.2" height="7" rx="0.4" fill="#ffffff" opacity="0.55" />
      </svg>
    </span>
  );
}

export function Wordmark({
  compact = false,
  subtitle,
  className,
}: {
  compact?: boolean;
  subtitle?: string;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold leading-tight tracking-tight text-slate-900">
            Cibilon
          </span>
          <span className="block truncate text-[11px] leading-tight text-slate-400">
            {subtitle ?? 'Advisor CRM'}
          </span>
        </span>
      )}
    </span>
  );
}
