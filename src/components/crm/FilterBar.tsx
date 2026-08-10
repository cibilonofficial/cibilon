import type { ReactNode } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterSelect {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}

interface FilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  selects?: FilterSelect[];
  /** ISO date strings. */
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  onReset?: () => void;
  activeCount?: number;
  trailing?: ReactNode;
}

const CONTROL =
  'h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-700 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export function FilterBar({
  query,
  onQueryChange,
  placeholder = 'Search…',
  selects = [],
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onReset,
  activeCount = 0,
  trailing,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className={cn(CONTROL, 'w-full pl-9 pr-8')}
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {selects.map((select) => (
        <select
          key={select.id}
          value={select.value}
          onChange={(e) => select.onChange(e.target.value)}
          aria-label={select.label}
          className={cn(CONTROL, 'max-w-[11rem]', !select.value && 'text-slate-500')}
        >
          <option value="">{select.label}</option>
          {select.options.map((option) => (
            <option key={option} value={option} className="text-slate-900">
              {option}
            </option>
          ))}
        </select>
      ))}

      {onDateFromChange && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom ?? ''}
            onChange={(e) => onDateFromChange(e.target.value)}
            aria-label="From date"
            className={cn(CONTROL, 'w-[9.5rem]')}
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={dateTo ?? ''}
            onChange={(e) => onDateToChange?.(e.target.value)}
            aria-label="To date"
            className={cn(CONTROL, 'w-[9.5rem]')}
          />
        </div>
      )}

      {onReset && activeCount > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          <SlidersHorizontal className="size-3.5" />
          Reset ({activeCount})
        </button>
      )}

      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}
