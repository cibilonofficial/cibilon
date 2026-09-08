import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-slate-200/80',
        className,
      )}
      aria-hidden
    >
      <img
        src="/cibilon-logo.png"
        alt="Cibilon Logo"
        className="size-full object-contain"
      />
    </span>
  );
}

export function LogoFull({ className }: { className?: string }) {
  return (
    <img
      src="/cibilon-logo.png"
      alt="Cibilon — Better Credit. Better Opportunities."
      className={cn('h-24 w-auto object-contain', className)}
    />
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
          <span className="block truncate text-[15px] font-bold leading-tight tracking-tight text-[#0b2447]">
            Cibilon
          </span>
          <span className="block truncate text-[11px] font-medium leading-tight text-slate-400">
            {subtitle ?? 'Advisor CRM'}
          </span>
        </span>
      )}
    </span>
  );
}
