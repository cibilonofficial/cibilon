/** Tiny classname joiner — enough for this app, no clsx dependency needed. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrNumber = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return inr.format(value);
}

/** ₹12,50,000 → "₹12.5L", ₹1,20,00,000 → "₹1.2Cr". For dense stat tiles. */
export function formatCompactCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  return `₹${inrNumber.format(value)}`;
}

export function formatNumber(value: number): string {
  return inrNumber.format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Masks all but the last 4 characters — used for PAN/Aadhaar/account numbers. */
export function maskId(value: string, visible = 4): string {
  if (!value) return '—';
  const clean = value.replace(/\s+/g, '');
  if (clean.length <= visible) return clean;
  return `${'•'.repeat(clean.length - visible)}${clean.slice(-visible)}`;
}

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function daysAgo(days: number, hour = 11): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, (days * 7) % 60, 0, 0);
  return d.toISOString();
}

/** Case-insensitive "does any field contain the query" test. */
export function matchesQuery(query: string, ...fields: (string | number | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => String(f ?? '').toLowerCase().includes(q));
}

export function downloadStub(fileName: string) {
  // Placeholder for a real signed-URL download once the backend exists.
  // eslint-disable-next-line no-console
  console.info(`[cibilon] download requested: ${fileName}`);
}
