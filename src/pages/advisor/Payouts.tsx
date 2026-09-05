import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarRange, Download, Hourglass, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { PayoutBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/Misc';
import { Pagination } from '@/components/ui/Pagination';
import { StatCard } from '@/components/ui/StatCard';
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
import { PayoutTrend } from '@/components/charts/Charts';
import { useToast } from '@/components/ui/Toast';
import { monthlyTrend } from '@/lib/metrics';
import { PAYOUT_STATUSES } from '@/lib/constants';
import { formatCompactCurrency, formatCurrency, formatDate, matchesQuery } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';

export function Payouts() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { payouts, loading } = useData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const param = searchParams.get('status');
    if (param) {
      setStatus(param);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const mine = useMemo(
    () => payouts.filter((p) => p.advisorId === user!.id),
    [payouts, user],
  );
  const trend = useMemo(() => monthlyTrend([], mine), [mine]);

  const totals = useMemo(() => {
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    return {
      total: mine.reduce((sum, p) => sum + p.payoutAmount, 0),
      pending: mine
        .filter((p) => p.status !== 'Paid')
        .reduce((sum, p) => sum + p.payoutAmount, 0),
      paid: mine.filter((p) => p.status === 'Paid').reduce((sum, p) => sum + p.payoutAmount, 0),
      thisMonth: mine
        .filter((p) => {
          const date = p.paymentDate ?? p.disbursementDate;
          if (!date) return false;
          const d = new Date(date);
          return d.getMonth() === month && d.getFullYear() === year;
        })
        .reduce((sum, p) => sum + p.payoutAmount, 0),
    };
  }, [mine]);

  const filtered = useMemo(
    () =>
      mine
        .filter((p) => matchesQuery(query, p.id, p.applicationId, p.customerName, p.service))
        .filter((p) => (status ? p.status === status : true))
        .filter((p) => (from ? new Date(p.disbursementDate ?? 0) >= new Date(from) : true))
        .filter((p) =>
          to ? new Date(p.disbursementDate ?? 0) <= new Date(`${to}T23:59:59`) : true,
        )
        .sort((a, b) => +new Date(b.disbursementDate ?? 0) - +new Date(a.disbursementDate ?? 0)),
    [mine, query, status, from, to],
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeFilters = [status, from, to].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Payouts"
        description="What you have earned, what is on the way, and what has already been credited."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="size-4" />}
            onClick={() => toast.info('Statement queued', 'Your payout statement will be emailed.')}
          >
            Download statement
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total earnings"
          value={formatCompactCurrency(totals.total)}
          icon={<Wallet className="size-4" />}
          tone="money"
          footnote={`${mine.length} confirmed or estimated record(s)`}
        />
        <StatCard
          label="Pending payout"
          value={formatCompactCurrency(totals.pending)}
          icon={<Hourglass className="size-4" />}
          tone="warn"
          footnote="Releases with the next cycle"
        />
        <StatCard
          label="Paid payout"
          value={formatCompactCurrency(totals.paid)}
          icon={<TrendingUp className="size-4" />}
          tone="brand"
          footnote="Credited to your bank account"
        />
        <StatCard
          label="This month"
          value={formatCompactCurrency(totals.thisMonth)}
          icon={<CalendarRange className="size-4" />}
          tone="neutral"
          delta={18}
          deltaLabel="vs last month"
        />
      </div>

      <Card className="mt-3">
        <CardHeader title="Earnings trend" subtitle="Rolling six-month payout" />
        <CardBody>
          <PayoutTrend data={trend} />
        </CardBody>
      </Card>

      <Card className="mt-3">
        <CardHeader title="Payout records" subtitle={`${filtered.length} record(s)`} />
        <FilterBar
          query={query}
          onQueryChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Search by application, customer or payout ID…"
          selects={[
            {
              id: 'status',
              label: 'All statuses',
              value: status,
              options: PAYOUT_STATUSES,
              onChange: (v) => {
                setStatus(v);
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
            setStatus('');
            setFrom('');
            setTo('');
            setPage(1);
          }}
          activeCount={activeFilters}
        />

        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="No payouts yet"
            description="An estimated payout appears after approval and is confirmed when the application is disbursed."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Application ID</TH>
                  <TH>Customer</TH>
                  <TH>Service</TH>
                  <TH>Disbursement date</TH>
                  <TH align="right">Basis amount</TH>
                  <TH align="right">Payout</TH>
                  <TH>Payout status</TH>
                  <TH>Payment date</TH>
                </THead>
                <TBody>
                  {paged.map((p) => (
                    <TR key={p.id} onClick={() => navigate(`/app/applications/${p.applicationId}`)}>
                      <TD className="font-medium text-slate-900">{p.applicationId}</TD>
                      <TD>{p.customerName}</TD>
                      <TD>{p.service}</TD>
                      <TD className="whitespace-nowrap">
                        {p.estimated ? 'Awaiting disbursal' : formatDate(p.disbursementDate)}
                      </TD>
                      <TD align="right" className="tnum">
                        {p.loanAmount ? formatCurrency(p.loanAmount) : '—'}
                      </TD>
                      <TD align="right">
                        <span className="tnum font-semibold text-money-700">
                          {formatCurrency(p.payoutAmount)}
                        </span>
                        {p.estimated && (
                          <span className="block text-[11px] font-medium text-amber-600">
                            Estimated
                          </span>
                        )}
                        {p.payoutRate > 0 && (
                          <span className="tnum block text-[11px] text-slate-400">
                            {p.payoutRate.toFixed(2)}% of {p.estimated ? 'requested amount' : 'disbursal'}
                          </span>
                        )}
                      </TD>
                      <TD>
                        <PayoutBadge status={p.status} />
                      </TD>
                      <TD className="whitespace-nowrap">
                        {formatDate(p.paymentDate)}
                        {p.utr && (
                          <span className="block font-mono text-[11px] text-slate-400">
                            {p.utr}
                          </span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            </div>

            <MobileCardList className="lg:hidden">
              {paged.map((p) => (
                <MobileRow
                  key={p.id}
                  onClick={() => navigate(`/app/applications/${p.applicationId}`)}
                  title={p.customerName}
                  subtitle={`${p.applicationId} · ${p.service}`}
                  badge={<PayoutBadge status={p.status} />}
                  rows={[
                    { label: 'Payout', value: formatCurrency(p.payoutAmount) },
                    {
                      label: 'Disbursed',
                      value: p.estimated ? 'Awaiting disbursal' : formatDate(p.disbursementDate),
                    },
                    {
                      label: 'Basis amount',
                      value: p.loanAmount ? formatCurrency(p.loanAmount) : '—',
                    },
                    ...(p.estimated ? [{ label: 'Calculation', value: 'Estimated' }] : []),
                    { label: 'Paid on', value: formatDate(p.paymentDate) },
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
