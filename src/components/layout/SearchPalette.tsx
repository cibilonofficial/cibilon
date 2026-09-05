import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileStack, Search, Users, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, formatCompactCurrency } from '@/lib/utils';
import { apiRequest, errorMessage } from '@/lib/api';
import type { Role } from '@/types';

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  role: Role;
  advisorId: string;
}

export function SearchPalette({ open, onClose, role, advisorId }: SearchPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const base = role === 'admin' ? '/admin' : role === 'staff' ? '/staff' : '/app';

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) { setGroups({}); setError(''); return; }
    const timer = window.setTimeout(() => {
      setLoading(true); setError('');
      apiRequest<{ data: { groups: Record<string, any[]> } }>(`/search?q=${encodeURIComponent(query.trim())}&limit=8`)
        .then((response) => setGroups(response.data.groups))
        .catch((requestError) => setError(errorMessage(requestError)))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  const appHits = groups.applications ?? [];
  const payoutHits = role === 'staff' ? [] : groups.payouts ?? [];
  const advisorHits = role === 'staff' ? [] : groups.advisors ?? [];
  void advisorId;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const nothing = !appHits.length && !payoutHits.length && !advisorHits.length;

  return (
    <Modal open={open} onClose={onClose} title="Search" size="lg">
      <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
        <Search className="size-4 shrink-0 text-slate-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Application ID, customer name, mobile, payout…"
          className="h-full w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      <div className="mt-4 space-y-5">
        {appHits.length > 0 && (
          <Group icon={<FileStack className="size-3.5" />} title="Applications">
            {appHits.map((a) => (
              <Row
                key={a.id}
                onClick={() => go(`${base}/applications/${a.id}`)}
                primary={a.customer.fullName}
                secondary={`${a.applicationNumber} · ${a.serviceType}`}
                trailing={<StatusBadge status={a.status.toLowerCase().replaceAll('_', ' ')} />}
              />
            ))}
          </Group>
        )}

        {payoutHits.length > 0 && (
          <Group icon={<Wallet className="size-3.5" />} title="Payouts">
            {payoutHits.map((p) => (
              <Row
                key={p.id}
                onClick={() => go(`${base}/payouts`)}
                primary={p.payoutNumber}
                secondary={p.applicationId}
                trailing={
                  <span className="tnum text-sm font-medium text-money-700">
                    {formatCompactCurrency(Number(p.payoutAmount))}
                  </span>
                }
              />
            ))}
          </Group>
        )}

        {advisorHits.length > 0 && (
          <Group icon={<Users className="size-3.5" />} title="Advisors">
            {advisorHits.map((a) => (
              <Row
                key={a.id}
                onClick={() => go('/admin/advisors')}
                primary={a.user.name}
                secondary={`${a.code} · ${a.agency}`}
                trailing={<span className="text-xs text-slate-500">{a.city}</span>}
              />
            ))}
          </Group>
        )}

        {loading && <p className="py-6 text-center text-sm text-slate-400">Searching…</p>}
        {error && <p className="py-6 text-center text-sm text-rose-600">{error}</p>}
        {!loading && !error && nothing && (
          <p className="py-10 text-center text-sm text-slate-400">
            {query ? `No results for “${query}”.` : 'Start typing to search.'}
          </p>
        )}
      </div>
    </Modal>
  );
}

function Group({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {icon}
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  onClick,
  primary,
  secondary,
  trailing,
}: {
  onClick: () => void;
  primary: string;
  secondary: string;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-100',
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-800">{primary}</span>
        <span className="block truncate text-xs text-slate-500">{secondary}</span>
      </span>
      {trailing}
    </button>
  );
}
