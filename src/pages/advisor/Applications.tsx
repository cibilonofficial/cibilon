import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, FileStack, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader, ProgressBar, Tabs } from '@/components/ui/Misc';
import { Pagination } from '@/components/ui/Pagination';
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
import { FilterBar } from '@/components/crm/FilterBar';
import { APPLICATION_STATUSES, SERVICES } from '@/lib/constants';
import { ACTIVE_STATUSES, COMPLETED_STATUSES } from '@/lib/metrics';
import { formatCurrency, formatDate, matchesQuery, relativeTime } from '@/lib/utils';
import { useMockLoading } from '@/hooks/useMockLoading';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import type { Application } from '@/types';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'action', label: 'Needs action' },
  { id: 'completed', label: 'Completed' },
  { id: 'rejected', label: 'Rejected' },
];

function inTab(app: Application, tab: string): boolean {
  switch (tab) {
    case 'active':
      return ACTIVE_STATUSES.includes(app.status);
    case 'action':
      return (
        app.status === 'Documents Required' ||
        app.status === 'Additional Information Required' ||
        app.status === 'Draft'
      );
    case 'completed':
      return COMPLETED_STATUSES.includes(app.status);
    case 'rejected':
      return app.status === 'Rejected';
    default:
      return true;
  }
}

export function Applications() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { applications, documents } = useData();
  const loading = useMockLoading();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dashboard stat cards deep-link into a pre-filtered view.
  useEffect(() => {
    const param = searchParams.get('status');
    if (!param) return;
    if (param === 'active') setTab('active');
    else setStatus(param);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const mine = useMemo(
    () => applications.filter((a) => a.advisorId === user!.id),
    [applications, user],
  );

  const docProgress = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    documents.forEach((doc) => {
      const entry = map.get(doc.applicationId) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (doc.status === 'Verified') entry.done += 1;
      map.set(doc.applicationId, entry);
    });
    return map;
  }, [documents]);

  const filtered = useMemo(
    () =>
      mine
        .filter((a) => inTab(a, tab))
        .filter((a) => matchesQuery(query, a.id, a.customer.fullName, a.customer.mobile, a.lender))
        .filter((a) => (status ? a.status === status : true))
        .filter((a) => (service ? a.service === service : true))
        .filter((a) => (from ? new Date(a.updatedAt) >= new Date(from) : true))
        .filter((a) => (to ? new Date(a.updatedAt) <= new Date(`${to}T23:59:59`) : true))
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    [mine, tab, query, status, service, from, to],
  );

  const counts = useMemo(
    () =>
      TABS.reduce<Record<string, number>>((acc, t) => {
        acc[t.id] = mine.filter((a) => inTab(a, t.id)).length;
        return acc;
      }, {}),
    [mine],
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeFilters = [status, service, from, to].filter(Boolean).length;

  const resetFilters = () => {
    setStatus('');
    setService('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Applications"
        description="Track every file from submission through to payout."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="size-4" />}
              onClick={() => toast.info('Export queued', 'Your CSV will be emailed shortly.')}
            >
              Export
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={() => navigate('/app/leads/new')}>
              New application
            </Button>
          </>
        }
      />

      <Card>
        <div className="px-4 pt-1 sm:px-5">
          <Tabs
            tabs={TABS.map((t) => ({ ...t, count: counts[t.id] }))}
            active={tab}
            onChange={(id) => {
              setTab(id);
              setPage(1);
            }}
          />
        </div>

        <FilterBar
          query={query}
          onQueryChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Search by application ID, customer, lender…"
          selects={[
            {
              id: 'status',
              label: 'All statuses',
              value: status,
              options: APPLICATION_STATUSES,
              onChange: (v) => {
                setStatus(v);
                setPage(1);
              },
            },
            {
              id: 'service',
              label: 'All services',
              value: service,
              options: SERVICES,
              onChange: (v) => {
                setService(v);
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
          onReset={resetFilters}
          activeCount={activeFilters}
        />

        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileStack className="size-5" />}
            title="No applications here"
            description="Nothing matches this view right now. Try another tab or clear the filters."
            action={
              activeFilters > 0 ? (
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Application</TH>
                  <TH>Customer</TH>
                  <TH>Service</TH>
                  <TH align="right">Amount</TH>
                  <TH>Lender</TH>
                  <TH>Documents</TH>
                  <TH>Status</TH>
                  <TH>Last update</TH>
                  <TH align="right">Expected payout</TH>
                </THead>
                <TBody>
                  {paged.map((app) => {
                    const progress = docProgress.get(app.id) ?? { done: 0, total: 0 };
                    return (
                      <TR key={app.id} onClick={() => navigate(`/app/applications/${app.id}`)}>
                        <TD className="font-medium text-slate-900">{app.id}</TD>
                        <TD>
                          <span className="block font-medium text-slate-800">
                            {app.customer.fullName}
                          </span>
                          <span className="tnum block text-xs text-slate-500">
                            {app.customer.mobile}
                          </span>
                        </TD>
                        <TD>{app.service}</TD>
                        <TD align="right" className="tnum">
                          {app.loanAmount ? formatCurrency(app.loanAmount) : '—'}
                        </TD>
                        <TD className="text-slate-600">{app.lender}</TD>
                        <TD className="w-36">
                          <ProgressBar
                            value={progress.done}
                            max={Math.max(1, progress.total)}
                            tone={progress.done === progress.total ? 'money' : 'brand'}
                          />
                          <span className="tnum mt-1 block text-[11px] text-slate-500">
                            {progress.done}/{progress.total} verified
                          </span>
                        </TD>
                        <TD>
                          <StatusBadge status={app.status} />
                        </TD>
                        <TD className="whitespace-nowrap text-slate-500">
                          {relativeTime(app.updatedAt)}
                        </TD>
                        <TD align="right" className="tnum font-medium text-money-700">
                          {formatCurrency(app.expectedPayout)}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </TableWrap>
            </div>

            <MobileCardList className="lg:hidden">
              {paged.map((app) => (
                <MobileRow
                  key={app.id}
                  onClick={() => navigate(`/app/applications/${app.id}`)}
                  title={app.customer.fullName}
                  subtitle={`${app.id} · ${app.service}`}
                  badge={<StatusBadge status={app.status} />}
                  rows={[
                    {
                      label: 'Amount',
                      value: app.loanAmount ? formatCurrency(app.loanAmount) : '—',
                    },
                    { label: 'Lender', value: app.lender },
                    { label: 'Updated', value: formatDate(app.updatedAt) },
                    { label: 'Payout', value: formatCurrency(app.expectedPayout) },
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
