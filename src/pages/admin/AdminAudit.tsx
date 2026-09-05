import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ScrollText, ShieldCheck, UserRound } from 'lucide-react';
import { FilterBar } from '@/components/crm/FilterBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { Avatar, PageHeader } from '@/components/ui/Misc';
import { Pagination } from '@/components/ui/Pagination';
import { StatCard } from '@/components/ui/StatCard';
import { Chip } from '@/components/ui/StatusBadge';
import {
  MobileCardList,
  MobileRow,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableWrap,
} from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { AUDIT_MODULES } from '@/lib/constants';
import { formatDateTime, matchesQuery, relativeTime } from '@/lib/utils';
import { useData } from '@/store/DataContext';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Operations',
  advisor: 'Advisor',
  System: 'System',
};

export function AdminAudit() {
  const navigate = useNavigate();
  const toast = useToast();
  const { auditLog, applications, loading } = useData();

  const [query, setQuery] = useState('');
  const [module, setModule] = useState('');
  const [actor, setActor] = useState('');
  const [role, setRole] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const actors = useMemo(
    () => [...new Set(auditLog.map((entry) => entry.actorName))].sort(),
    [auditLog],
  );

  const appIds = useMemo(() => new Set(applications.map((a) => a.id)), [applications]);

  const filtered = useMemo(
    () =>
      auditLog
        .filter((entry) =>
          matchesQuery(query, entry.actorName, entry.action, entry.details, entry.entityId, entry.module),
        )
        .filter((entry) => (module ? entry.module === module : true))
        .filter((entry) => (actor ? entry.actorName === actor : true))
        .filter((entry) => (role ? ROLE_LABELS[entry.actorRole] === role : true))
        .filter((entry) => (from ? new Date(entry.at) >= new Date(from) : true))
        .filter((entry) => (to ? new Date(entry.at) <= new Date(`${to}T23:59:59`) : true))
        .sort((a, b) => +new Date(b.at) - +new Date(a.at)),
    [auditLog, query, module, actor, role, from, to],
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeFilters = [module, actor, role, from, to].filter(Boolean).length;

  const today = new Date().toDateString();
  const totals = {
    total: auditLog.length,
    today: auditLog.filter((e) => new Date(e.at).toDateString() === today).length,
    actors: actors.length,
    modules: new Set(auditLog.map((e) => e.module)).size,
  };

  return (
    <>
      <PageHeader
        title="Audit logs"
        description="Every action taken inside the console — who did it, on what, and when."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="size-4" />}
            onClick={() => toast.info('Export queued', 'The audit extract will be emailed to you.')}
          >
            Export
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Recorded events"
          value={totals.total}
          icon={<ScrollText className="size-4" />}
          tone="brand"
        />
        <StatCard label="Today" value={totals.today} icon={<ScrollText className="size-4" />} tone="info" />
        <StatCard label="Distinct users" value={totals.actors} icon={<UserRound className="size-4" />} tone="neutral" />
        <StatCard
          label="Modules touched"
          value={totals.modules}
          icon={<ShieldCheck className="size-4" />}
          tone="money"
        />
      </div>

      <Card className="mt-3">
        <FilterBar
          query={query}
          onQueryChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Search by user, action, application or lead…"
          selects={[
            {
              id: 'module',
              label: 'All modules',
              value: module,
              options: AUDIT_MODULES,
              onChange: (v) => {
                setModule(v);
                setPage(1);
              },
            },
            {
              id: 'actor',
              label: 'All users',
              value: actor,
              options: actors,
              onChange: (v) => {
                setActor(v);
                setPage(1);
              },
            },
            {
              id: 'role',
              label: 'All roles',
              value: role,
              options: ['Operations', 'Advisor', 'System'],
              onChange: (v) => {
                setRole(v);
                setPage(1);
              },
            },
          ]}
          dateFrom={from}
          dateTo={to}
          onDateFromChange={(v) => {
            setFrom(v);
            setPage(1);
          }}
          onDateToChange={(v) => {
            setTo(v);
            setPage(1);
          }}
          onReset={() => {
            setModule('');
            setActor('');
            setRole('');
            setFrom('');
            setTo('');
            setPage(1);
          }}
          activeCount={activeFilters}
        />

        {loading ? (
          <TableSkeleton rows={10} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="size-5" />}
            title="No activity in this window"
            description="Try widening the date range or clearing the module filter."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Timestamp</TH>
                  <TH>User</TH>
                  <TH>Action</TH>
                  <TH>Module</TH>
                  <TH>Application / lead</TH>
                  <TH>Details</TH>
                  <TH>IP</TH>
                </THead>
                <TBody>
                  {paged.map((entry) => (
                    <TR key={entry.id}>
                      <TD className="whitespace-nowrap">
                        <span className="block text-[13px] text-slate-700">
                          {formatDateTime(entry.at)}
                        </span>
                        <span className="block text-xs text-slate-400">{relativeTime(entry.at)}</span>
                      </TD>
                      <TD>
                        <span className="flex items-center gap-2">
                          <Avatar
                            name={entry.actorName}
                            color={entry.actorRole === 'admin' ? 'bg-slate-800' : 'bg-brand-600'}
                            size="sm"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-slate-800">
                              {entry.actorName}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {ROLE_LABELS[entry.actorRole]}
                            </span>
                          </span>
                        </span>
                      </TD>
                      <TD className="font-medium text-slate-800">{entry.action}</TD>
                      <TD>
                        <Chip tone="neutral">{entry.module}</Chip>
                      </TD>
                      <TD>
                        {entry.entityId ? (
                          appIds.has(entry.entityId) ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/applications/${entry.entityId}`)}
                              className="font-medium text-brand-700 hover:underline"
                            >
                              {entry.entityId}
                            </button>
                          ) : (
                            <span className="text-slate-600">{entry.entityId}</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TD>
                      <TD className="max-w-[20rem]">
                        <span className="line-clamp-2 text-[13px] text-slate-600">
                          {entry.details}
                        </span>
                      </TD>
                      <TD className="font-mono text-xs text-slate-400">{entry.ip}</TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            </div>

            <MobileCardList className="lg:hidden">
              {paged.map((entry) => (
                <MobileRow
                  key={entry.id}
                  title={entry.action}
                  subtitle={`${entry.actorName} · ${ROLE_LABELS[entry.actorRole]}`}
                  badge={<Chip tone="neutral">{entry.module}</Chip>}
                  rows={[
                    { label: 'When', value: formatDateTime(entry.at) },
                    { label: 'Entity', value: entry.entityId ?? '—' },
                    { label: 'Details', value: entry.details },
                  ]}
                />
              ))}
            </MobileCardList>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>
    </>
  );
}
