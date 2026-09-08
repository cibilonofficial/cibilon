import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONTROL =
  'w-full rounded-xl border bg-white/95 px-3.5 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 ' +
  'hover:border-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

const OK = 'border-slate-300 focus:border-brand-500';
const BAD = 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20';

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function FieldShell({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="field-label">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

// `prefix` on InputHTMLAttributes is the (string-typed) HTML attribute; ours is a node.
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  containerClassName?: string;
}

export function Input({
  label,
  hint,
  error,
  prefix,
  suffix,
  containerClassName,
  className,
  id,
  required,
  ...rest
}: InputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
      className={containerClassName}
    >
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          {...rest}
          className={cn(
            CONTROL,
            'h-11',
            error ? BAD : OK,
            prefix ? 'pl-8' : null,
            suffix ? 'pr-10' : null,
            className,
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{suffix}</span>
        )}
      </div>
    </FieldShell>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  options: readonly (string | { label: string; value: string })[];
  containerClassName?: string;
}

export function Select({
  label,
  hint,
  error,
  placeholder = 'Select…',
  options,
  containerClassName,
  className,
  id,
  required,
  ...rest
}: SelectProps) {
  const generated = useId();
  const selectId = id ?? generated;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={selectId}
      className={containerClassName}
    >
      <div className="relative">
        <select
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          {...rest}
          className={cn(
            CONTROL,
            'h-11 appearance-none pr-9',
            error ? BAD : OK,
            !rest.value && 'text-slate-400',
            className,
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => {
            const value = typeof option === 'string' ? option : option.value;
            const text = typeof option === 'string' ? option : option.label;
            return (
              <option key={value} value={value} className="text-slate-900">
                {text}
              </option>
            );
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      </div>
    </FieldShell>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export function Textarea({
  label,
  hint,
  error,
  containerClassName,
  className,
  id,
  required,
  rows = 3,
  ...rest
}: TextareaProps) {
  const generated = useId();
  const areaId = id ?? generated;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={areaId}
      className={containerClassName}
    >
      <textarea
        id={areaId}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        {...rest}
        className={cn(CONTROL, 'py-2 leading-relaxed', error ? BAD : OK, className)}
      />
    </FieldShell>
  );
}

interface RadioCardsProps {
  label?: string;
  name: string;
  value: string;
  options: { value: string; label: string; description?: string; icon?: ReactNode }[];
  onChange: (value: string) => void;
  error?: string;
  columns?: string;
}

export function RadioCards({
  label,
  name,
  value,
  options,
  onChange,
  error,
  columns = 'sm:grid-cols-2 lg:grid-cols-4',
}: RadioCardsProps) {
  return (
    <FieldShell label={label} error={error}>
      <div className={cn('grid gap-3', columns)}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-sm transition-all',
                active
                  ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-500/15'
                  : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={active}
                onChange={() => onChange(option.value)}
                className="mt-0.5 size-4 accent-brand-700"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  {option.icon}
                  {option.label}
                </span>
                {option.description && (
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </FieldShell>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-sm text-slate-600', className)}>
      <input
        type="checkbox"
        {...rest}
        className="size-4 rounded border-slate-300 accent-brand-700"
      />
      {label}
    </label>
  );
}
