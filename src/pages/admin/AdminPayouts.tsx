import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BanknoteArrowUp, CheckCheck, Hourglass, Loader, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { ConfirmDialog } from '@/components/ui/Modal';
import { PayoutBadge } from '@/components/ui/StatusBadge';
import { Avatar, PageHeader, Tabs } from '@/components/ui/Misc';
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
import { useData } from '@/store/DataContext';
import type { PayoutStatus } from '@/types';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'Pending', label: 'Pending' },
  { id: 'Processing', label: 'Processing' },
  { id: 'Paid', label: 'Paid' },
];

export function AdminPayouts() {
  const navigate = useNavigate();
  const toast = useToast();
  const { payouts, advisors, updatePayoutStatus, loading } = useData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [advisorFilter, setAdvisorFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selection, setSelection] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    const param = searchParams.get('status');
    if (param) {
      setTab(param);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const advisorMap = useMemo(() => new Map(advisors.map((a) => [a.id, a])), [advisors]);

  const totals = useMemo(
    () => ({
      total: payouts.reduce((sum, p) => sum + p.payoutAmount, 0),
      pending: payouts
        .filter((p) => p.status === 'Pending')
        .reduce((sum, p) => sum + p.payoutAmount, 0),
      processing: payouts
        .filter((p) => p.status === 'Processing')
        .reduce((sum, p) => sum + p.payoutAmount, 0),
      paid: payouts.filter((p) => p.status === 'Paid').reduce((sum, p) => sum + p.payoutAmount, 0),
    }),
    [payouts],
  );
  const trend = useMemo(() => monthlyTrend([], payouts), [payouts]);

  const filtered = useMemo(
    () =>
      payouts
        .filter((p) => (tab === 'all' ? true : p.status === tab))
        .filter((p) =>
          matchesQuery(
            query,
            p.id,
            p.applicationId,
            p.customerName,
            advisorMap.get(p.advisorId)?.name,
          ),
        )
        .filter((p) =>
          advisorFilter ? advisorMap.get(p.advisorId)?.name === advisorFilter : true,
        )
        .filter((p) => (from ? new Date(p.disbursementDate ?? 0) >= new Date(from) : true))
        .filter((p) =>
          to ? new Date(p.disbursementDate ?? 0) <= new Date(`${to}T23:59:59`) : true,
        )
        .sort((a, b) => +new Date(b.disbursementDate ?? 0) - +new Date(a.disbursementDate ?? 0)),
    [payouts, tab, query, advisorFilter, from, to, advisorMap],
  );

  const counts = useMemo(
    () => ({
      all: payouts.length,
      Pending: payouts.filter((p) => p.status === 'Pending').length,
      Processing: payouts.filter((p) => p.status === 'Processing').length,
      Paid: payouts.filter((p) => p.status === 'Paid').length,
    }),
    [payouts],
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selectable = paged.filter((p) => !p.estimated && p.status !== 'Paid');
  const selectedAmount = payouts
    .filter((p) => selection.includes(p.id))
    .reduce((sum, p) => sum + p.payoutAmount, 0);

  const toggle = (id: string) =>
    setSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const releaseSelected = () => {
    selection.forEach((id) => updatePayoutStatus(id, 'Paid'));
    toast.success(
      'Payout run completed',
      `${selection.length} payout(s) totalling ${formatCurrency(selectedAmount)} marked as paid.`,
    );
    setSelection([]);
    setBulkOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Payout management"
        description="Review estimates after approval, then process and release confirmed payouts after disbursal."
        actions={
          <Button
            icon={<BanknoteArrowUp className="size-4" />}
            disabled={selection.length === 0}
            onClick={() => setBulkOpen(true)}
          >
            Release {selection.length > 0 ? `${selection.length} payout(s)` : 'payouts'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total payouts"
          value={formatCompactCurrency(totals.total)}
          icon={<Wallet className="size-4" />}
          tone="brand"
          footnote={`${payouts.length} records`}
        />
        <StatCard
          label="Pending"
          value={formatCompactCurrency(totals.pending)}
          icon={<Hourglass className="size-4" />}
          tone="warn"
          footnote={`${counts.Pending} awaiting release`}
          onClick={() => setTab('Pending')}
        />
        <StatCard
          label="Processing"
          value={formatCompactCurrency(totals.processing)}
          icon={<Loader className="size-4" />}
          tone="info"
          footnote={`${counts.Processing} in the bank queue`}
          onClick={() => setTab('Processing')}
        />
        <StatCard
          label="Paid"
          value={formatCompactCurrency(totals.paid)}
          icon={<CheckCheck className="size-4" />}
          tone="money"
          footnote={`${counts.Paid} settled`}
          onClick={() => setTab('Paid')}
        />
      </div>

      <Card className="mt-3">
        <CardHeader title="Payout outflow" subtitle="Rolling six months" />
        <CardBody>
          <PayoutTrend data={trend} />
        </CardBody>
      </Card>

      <Card className="mt-3">
        <div className="px-4 pt-1 sm:px-5">
          <Tabs
            tabs={TABS.map((t) => ({ ...t, count: counts[t.id as keyof typeof counts] }))}
            active={tab}
            onChange={(id) => {
              setTab(id);
              setPage(1);
              setSelection([]);
            }}
          />
        </div>

        <FilterBar
          query={query}
          onQueryChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Search by payout, application, customer or advisor…"
          selects={[
            {
              id: 'advisor',
              label: 'All advisors',
              value: advisorFilter,
              options: advisors.map((a) => a.name),
              onChange: (v) => {
                setAdvisorFilter(v);
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
            setAdvisorFilter('');
            setFrom('');
            setTo('');
            setPage(1);
          }}
          activeCount={[advisorFilter, from, to].filter(Boolean).length}
          trailing={
            selection.length > 0 && (
              <span className="tnum text-[13px] font-medium text-slate-600">
                {selection.length} selected · {formatCurrency(selectedAmount)}
              </span>
            )
          }
        />

        {loading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="No payouts in this view"
            description="Estimated payouts appear after approval and become releasable after disbursal."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableWrap className="min-w-full">
                <THead>
                  <TH className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all releasable payouts on this page"
                      className="size-4 rounded border-slate-300 accent-brand-700"
                      checked={
                        selectable.length > 0 &&
                        selectable.every((p) => selection.includes(p.id))
                      }
                      onChange={(e) =>
                        setSelection(e.target.checked ? selectable.map((p) => p.id) : [])
                      }
                    />
                  </TH>
                  <TH>Payout</TH>
                  <TH>Advisor</TH>
                  <TH>Customer</TH>
                  <TH>Service</TH>
                  <TH>Disbursed</TH>
                  <TH align="right">Loan amount</TH>
                  <TH align="right">Payout</TH>
                  <TH>Status</TH>
                  <TH align="right">Action</TH>
                </THead>
                <TBody>
                  {paged.map((p) => {
                    const advisor = advisorMap.get(p.advisorId);
                    return (
                      <TR key={p.id}>
                        <TD>
                          <input
                            type="checkbox"
                            aria-label={`Select payout ${p.id}`}
                            disabled={p.estimated || p.status === 'Paid'}
                            checked={selection.includes(p.id)}
                            onChange={() => toggle(p.id)}
                            className="size-4 rounded border-slate-300 accent-brand-700 disabled:opacity-40"
                          />
                        </TD>
                        <TD>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/applications/${p.applicationId}`)}
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {p.applicationId}
                          </button>
                          <span className="block text-xs text-slate-500">{p.id}</span>
                        </TD>
                        <TD>
                          <span className="flex items-center gap-2">
                            <Avatar
                              name={advisor?.name ?? '—'}
                              color={advisor?.avatarColor}
                              size="sm"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] text-slate-700">
                                {advisor?.name ?? '—'}
                              </span>
                              <span className="block text-xs text-slate-500">
                                {advisor?.code ?? ''}
                              </span>
                            </span>
                          </span>
                        </TD>
                        <TD>{p.customerName}</TD>
                        <TD>{p.service}</TD>
                        <TD className="whitespace-nowrap">
                          {p.estimated ? 'Awaiting disbursal' : formatDate(p.disbursementDate)}
                        </TD>
                        <TD align="right" className="tnum">
                          {p.loanAmount ? formatCurrency(p.loanAmount) : '—'}
                        </TD>
                        <TD align="right" className="tnum font-semibold text-money-700">
                          {formatCurrency(p.payoutAmount)}
                          {p.estimated && (
                            <span className="block text-[11px] font-medium text-amber-600">
                              Estimated
                            </span>
                          )}
                        </TD>
                        <TD>
                          <PayoutBadge status={p.status} />
                          {p.utr && (
                            <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                              {p.utr}
                            </span>
                          )}
                        </TD>
                        <TD align="right">
                          <select
                            value={p.status}
                            disabled={p.estimated}
                            onChange={(e) => {
                              updatePayoutStatus(p.id, e.target.value as PayoutStatus);
                              toast.success(
                                'Payout updated',
                                `${p.applicationId} → ${e.target.value}`,
                              );
                            }}
                            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-700 focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {PAYOUT_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </TableWrap>
            </div>

            <MobileCardList className="lg:hidden">
              {paged.map((p) => (
                <MobileRow
                  key={p.id}
                  title={p.customerName}
                  subtitle={`${p.applicationId} · ${advisorMap.get(p.advisorId)?.name ?? ''}`}
                  badge={<PayoutBadge status={p.status} />}
                  rows={[
                    {
                      label: 'Payout',
                      value: `${formatCurrency(p.payoutAmount)}${p.estimated ? ' (estimated)' : ''}`,
                    },
                    { label: 'Service', value: p.service },
                    {
                      label: 'Disbursed',
                      value: p.estimated ? 'Awaiting disbursal' : formatDate(p.disbursementDate),
                    },
                    { label: 'Paid on', value: formatDate(p.paymentDate) },
                  ]}
                  action={
                    !p.estimated && p.status !== 'Paid' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          updatePayoutStatus(p.id, 'Paid');
                          toast.success('Payout released', `${p.applicationId} marked as paid.`);
                        }}
                      >
                        Mark as paid
                      </Button>
                    )
                  }
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

      <ConfirmDialog
        open={bulkOpen}
        title="Release selected payouts?"
        message={
          <>
            {selection.length} payout(s) totalling{' '}
            <span className="font-semibold text-slate-900">{formatCurrency(selectedAmount)}</span>{' '}
            will be marked as paid and the advisors will be notified.
          </>
        }
        confirmLabel="Release payouts"
        onConfirm={releaseSelected}
        onCancel={() => setBulkOpen(false)}
      />
    </>
  );
}
