import { useMemo, useState } from 'react';
import { Download, FileStack, Landmark, TrendingUp, Users, Wallet } from 'lucide-react';
import { PayoutTrend, ServiceBars, StatusDonut, VolumeBars } from '@/components/charts/Charts';
import { FilterBar } from '@/components/crm/FilterBar';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { PageHeader, ProgressBar, Tabs } from '@/components/ui/Misc';
import { StatCard } from '@/components/ui/StatCard';
import { Chip } from '@/components/ui/StatusBadge';
import { TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { SERVICES } from '@/lib/constants';
import {
  ACTIVE_STATUSES,
  COMPLETED_STATUSES,
  advisorRollup,
  computeMetrics,
  monthlyTrend,
  serviceDistribution,
  statusDistribution,
} from '@/lib/metrics';
import { formatCompactCurrency, formatCurrency, formatNumber } from '@/lib/utils';
import { useData } from '@/store/DataContext';
import { apiDownload, apiRequest, errorMessage } from '@/lib/api';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'advisors', label: 'Advisor performance' },
  { id: 'applications', label: 'Application statistics' },
  { id: 'disbursement', label: 'Disbursement' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'partners', label: 'Lenders & services' },
];

export function AdminReports() {
  const toast = useToast();
  const { applications, documents, payouts, advisors, lenders } = useData();

  const [tab, setTab] = useState('overview');
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const scoped = useMemo(
    () =>
      applications
        .filter((a) => (service ? a.service === service : true))
        .filter((a) => (from ? new Date(a.createdAt) >= new Date(from) : true))
        .filter((a) => (to ? new Date(a.createdAt) <= new Date(`${to}T23:59:59`) : true)),
    [applications, service, from, to],
  );

  const scopedIds = useMemo(() => new Set(scoped.map((a) => a.id)), [scoped]);
  const scopedPayouts = useMemo(
    () => payouts.filter((p) => scopedIds.has(p.applicationId)),
    [payouts, scopedIds],
  );

  const metrics = useMemo(
    () => computeMetrics(scoped, documents, scopedPayouts),
    [scoped, documents, scopedPayouts],
  );

  const advisorRows = useMemo(
    () =>
      advisors
        .map((advisor) => ({
          advisor,
          ...advisorRollup(advisor.id, scoped, scopedPayouts),
        }))
        .filter(({ advisor }) =>
          query
            ? `${advisor.name} ${advisor.code} ${advisor.city}`
                .toLowerCase()
                .includes(query.trim().toLowerCase())
            : true,
        )
        .sort((a, b) => b.totalPayout - a.totalPayout),
    [advisors, scoped, scopedPayouts, query],
  );

  const serviceRows = useMemo(
    () =>
      SERVICES.map((svc) => {
        const rows = scoped.filter((a) => a.service === svc);
        const done = rows.filter((a) => COMPLETED_STATUSES.includes(a.status));
        const paid = scopedPayouts.filter((p) => p.service === svc);
        return {
          service: svc,
          files: rows.length,
          active: rows.filter((a) => ACTIVE_STATUSES.includes(a.status)).length,
          disbursed: done.length,
          volume: done.reduce((sum, a) => sum + a.loanAmount, 0),
          payout: paid.reduce((sum, p) => sum + p.payoutAmount, 0),
        };
      })
        .filter((row) => row.files > 0)
        .sort((a, b) => b.volume - a.volume),
    [scoped, scopedPayouts],
  );

  const lenderRows = useMemo(
    () =>
      lenders
        .map((lender) => {
          const rows = scoped.filter((a) => a.lender === lender.name);
          const done = rows.filter((a) => COMPLETED_STATUSES.includes(a.status));
          const decided = rows.filter((a) =>
            ['Approved', 'Rejected', 'Disbursed', 'Completed'].includes(a.status),
          );
          return {
            lender,
            files: rows.length,
            disbursed: done.length,
            volume: done.reduce((sum, a) => sum + a.loanAmount, 0),
            approvalRate: decided.length
              ? Math.round(
                  (decided.filter((a) => a.status !== 'Rejected').length / decided.length) * 100,
                )
              : 0,
          };
        })
        .filter((row) => row.files > 0)
        .sort((a, b) => b.volume - a.volume),
    [lenders, scoped],
  );

  const monthlyDisbursement = useMemo(() => {
    // Keyed by YYYY-MM so the series can be sorted chronologically, with a
    // short label carried alongside for the axis.
    const map = new Map<
      string,
      { month: string; submitted: number; disbursed: number; payout: number }
    >();
    const bucket = (iso: string) => {
      const d = new Date(iso);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry =
        map.get(key) ??
        {
          month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
          submitted: 0,
          disbursed: 0,
          payout: 0,
        };
      map.set(key, entry);
      return entry;
    };

    scoped.forEach((app) => {
      const entry = bucket(app.createdAt);
      entry.submitted += 1;
      if (COMPLETED_STATUSES.includes(app.status)) entry.disbursed += 1;
    });
    scopedPayouts.forEach((p) => {
      const date = p.paymentDate ?? p.disbursementDate;
      if (!date) return;
      bucket(date).payout += p.payoutAmount;
    });

    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, value]) => value);
  }, [scoped, scopedPayouts]);

  const activeFilters = [service, from, to].filter(Boolean).length;
  const trend = useMemo(() => monthlyTrend(scoped, scopedPayouts), [scoped, scopedPayouts]);
  const exportReport = async () => {
    setExporting(true);
    try {
      const reportType = tab === 'advisors' ? 'ADVISORS' : tab === 'payouts' ? 'PAYOUTS' : tab === 'partners' ? 'LENDERS' : 'APPLICATIONS';
      const queued = await apiRequest<{ data: { id: string } }>('/reports/exports', {
        method: 'POST',
        body: { reportType, format: 'CSV', filters: { ...(service ? { serviceType: service } : {}), ...(from ? { dateFrom: from } : {}), ...(to ? { dateTo: to } : {}) } },
      });
      toast.info('Export queued', 'Preparing your CSV download…');
      let completed = false;
      for (let attempt = 0; attempt < 45; attempt += 1) {
        const job = await apiRequest<{ data: { status: string; errorMessage?: string } }>(`/reports/exports/${queued.data.id}`);
        if (job.data.status === 'FAILED') throw new Error(job.data.errorMessage ?? 'Export failed');
        if (job.data.status === 'COMPLETED') { completed = true; break; }
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
      if (!completed) throw new Error('The export is still processing. Try again shortly.');
      const { blob, fileName } = await apiDownload(`/reports/exports/${queued.data.id}/download`);
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
      toast.success('Report downloaded', fileName);
    } catch (requestError) {
      toast.error('Export failed', errorMessage(requestError));
    } finally { setExporting(false); }
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description="Network performance across advisors, products, lenders and payouts."
        actions={
          <Button variant="secondary" icon={<Download className="size-4" />} loading={exporting} onClick={() => void exportReport()}>
            Export report
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Applications"
          value={formatNumber(metrics.totalLeads)}
          icon={<FileStack className="size-4" />}
          tone="brand"
          footnote={`${metrics.active} in processing`}
        />
        <StatCard
          label="Disbursed volume"
          value={formatCompactCurrency(metrics.disbursedVolume)}
          icon={<Landmark className="size-4" />}
          tone="money"
          footnote={`${metrics.completed} files closed`}
        />
        <StatCard
          label="Payout released"
          value={formatCompactCurrency(metrics.paidPayout)}
          icon={<Wallet className="size-4" />}
          tone="money"
          footnote={`${formatCompactCurrency(metrics.pendingPayout)} pending`}
        />
        <StatCard
          label="Approval rate"
          value={`${metrics.approvalRate}%`}
          icon={<TrendingUp className="size-4" />}
          tone="info"
          footnote={`${metrics.rejected} rejected`}
        />
      </div>

      <Card className="mt-3">
        <div className="px-4 pt-1 sm:px-5">
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
        </div>
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search advisors in this report…"
          selects={[
            {
              id: 'service',
              label: 'All services',
              value: service,
              options: SERVICES,
              onChange: setService,
            },
          ]}
          dateFrom={from}
          dateTo={to}
          onDateFromChange={setFrom}
          onDateToChange={setTo}
          onReset={() => {
            setService('');
            setFrom('');
            setTo('');
          }}
          activeCount={activeFilters}
        />

        <CardBody>
          {scoped.length === 0 ? (
            <EmptyState
              icon={<FileStack className="size-5" />}
              title="Nothing in this window"
              description="No applications fall inside the selected filters."
            />
          ) : tab === 'overview' ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <Card>
                <CardHeader title="Volume by month" subtitle="Submitted vs disbursed" />
                <CardBody>
                  <VolumeBars data={monthlyDisbursement.length > 1 ? monthlyDisbursement : trend} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Applications by status" />
                <CardBody>
                  <StatusDonut data={statusDistribution(scoped)} total={scoped.length} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Applications by service" />
                <CardBody>
                  <ServiceBars data={serviceDistribution(scoped)} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Payout outflow" subtitle="Rolling six months" />
                <CardBody>
                  <PayoutTrend data={trend} />
                </CardBody>
              </Card>
            </div>
          ) : tab === 'advisors' ? (
            <TableWrap className="min-w-full">
              <THead>
                <TH>Advisor</TH>
                <TH align="right">Leads</TH>
                <TH align="right">Active</TH>
                <TH align="right">Completed</TH>
                <TH align="right">Rejected</TH>
                <TH>Conversion</TH>
                <TH align="right">Payout earned</TH>
                <TH align="right">Pending</TH>
              </THead>
              <TBody>
                {advisorRows.map(
                  ({ advisor, totalLeads, active, completed, rejected, totalPayout, pendingPayout }) => (
                    <TR key={advisor.id}>
                      <TD>
                        <span className="block font-medium text-slate-900">{advisor.name}</span>
                        <span className="block text-xs text-slate-500">
                          {advisor.code} · {advisor.city}
                        </span>
                      </TD>
                      <TD align="right" className="tnum">
                        {totalLeads}
                      </TD>
                      <TD align="right" className="tnum">
                        {active}
                      </TD>
                      <TD align="right" className="tnum">
                        {completed}
                      </TD>
                      <TD align="right" className="tnum">
                        {rejected}
                      </TD>
                      <TD className="w-40">
                        <ProgressBar
                          value={completed}
                          max={Math.max(1, totalLeads)}
                          tone={completed ? 'money' : 'brand'}
                        />
                      </TD>
                      <TD align="right" className="tnum font-semibold text-money-700">
                        {formatCurrency(totalPayout)}
                      </TD>
                      <TD align="right" className="tnum text-amber-700">
                        {formatCurrency(pendingPayout)}
                      </TD>
                    </TR>
                  ),
                )}
              </TBody>
            </TableWrap>
          ) : tab === 'applications' ? (
            <div className="space-y-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Status mix" />
                  <CardBody>
                    <StatusDonut data={statusDistribution(scoped)} total={scoped.length} />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Service mix" />
                  <CardBody>
                    <ServiceBars data={serviceDistribution(scoped)} />
                  </CardBody>
                </Card>
              </div>
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Service</TH>
                  <TH align="right">Files</TH>
                  <TH align="right">In processing</TH>
                  <TH align="right">Disbursed</TH>
                  <TH align="right">Volume</TH>
                  <TH align="right">Payout</TH>
                </THead>
                <TBody>
                  {serviceRows.map((row) => (
                    <TR key={row.service}>
                      <TD className="font-medium text-slate-900">{row.service}</TD>
                      <TD align="right" className="tnum">
                        {row.files}
                      </TD>
                      <TD align="right" className="tnum">
                        {row.active}
                      </TD>
                      <TD align="right" className="tnum">
                        {row.disbursed}
                      </TD>
                      <TD align="right" className="tnum">
                        {formatCurrency(row.volume)}
                      </TD>
                      <TD align="right" className="tnum font-medium text-money-700">
                        {formatCurrency(row.payout)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            </div>
          ) : tab === 'disbursement' ? (
            <div className="space-y-3">
              <Card>
                <CardHeader title="Disbursement trend" subtitle="Files created vs disbursed" />
                <CardBody>
                  <VolumeBars data={monthlyDisbursement.length > 1 ? monthlyDisbursement : trend} />
                </CardBody>
              </Card>
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Application</TH>
                  <TH>Customer</TH>
                  <TH>Advisor</TH>
                  <TH>Lender</TH>
                  <TH>Service</TH>
                  <TH align="right">Disbursed amount</TH>
                  <TH align="right">Payout</TH>
                </THead>
                <TBody>
                  {scoped
                    .filter((a) => COMPLETED_STATUSES.includes(a.status))
                    .map((app) => (
                      <TR key={app.id}>
                        <TD className="font-medium text-slate-900">{app.id}</TD>
                        <TD>{app.customer.fullName}</TD>
                        <TD className="text-slate-600">{app.advisorName}</TD>
                        <TD className="text-slate-600">{app.lender}</TD>
                        <TD>{app.service}</TD>
                        <TD align="right" className="tnum">
                          {formatCurrency(app.loanAmount)}
                        </TD>
                        <TD align="right" className="tnum font-medium text-money-700">
                          {formatCurrency(app.expectedPayout)}
                        </TD>
                      </TR>
                    ))}
                </TBody>
              </TableWrap>
            </div>
          ) : tab === 'payouts' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label="Total raised"
                  value={formatCompactCurrency(metrics.totalPayout)}
                  icon={<Wallet className="size-4" />}
                  tone="brand"
                />
                <StatCard
                  label="Released"
                  value={formatCompactCurrency(metrics.paidPayout)}
                  icon={<Wallet className="size-4" />}
                  tone="money"
                />
                <StatCard
                  label="Outstanding"
                  value={formatCompactCurrency(metrics.pendingPayout)}
                  icon={<Wallet className="size-4" />}
                  tone="warn"
                />
                <StatCard
                  label="This month"
                  value={formatCompactCurrency(metrics.thisMonthPayout)}
                  icon={<Wallet className="size-4" />}
                  tone="info"
                />
              </div>
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Payout</TH>
                  <TH>Advisor</TH>
                  <TH>Customer</TH>
                  <TH>Service</TH>
                  <TH align="right">Rate</TH>
                  <TH align="right">Amount</TH>
                  <TH>Status</TH>
                </THead>
                <TBody>
                  {scopedPayouts.map((p) => (
                    <TR key={p.id}>
                      <TD className="font-medium text-slate-900">{p.applicationId}</TD>
                      <TD className="text-slate-600">
                        {advisors.find((a) => a.id === p.advisorId)?.name ?? '—'}
                      </TD>
                      <TD>{p.customerName}</TD>
                      <TD>{p.service}</TD>
                      <TD align="right" className="tnum">
                        {p.payoutRate ? `${p.payoutRate.toFixed(2)}%` : 'Flat'}
                      </TD>
                      <TD align="right" className="tnum font-medium text-money-700">
                        {formatCurrency(p.payoutAmount)}
                      </TD>
                      <TD>
                        <Chip
                          tone={p.status === 'Paid' ? 'money' : p.status === 'Pending' ? 'warn' : 'brand'}
                        >
                          {p.status}
                        </Chip>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            </div>
          ) : (
            <TableWrap className="min-w-full">
              <THead>
                <TH>Lender</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH align="right">Files logged</TH>
                <TH align="right">Disbursed</TH>
                <TH align="right">Volume</TH>
                <TH>Approval rate</TH>
                <TH align="right">TAT</TH>
              </THead>
              <TBody>
                {lenderRows.map((row) => (
                  <TR key={row.lender.id}>
                    <TD className="font-medium text-slate-900">{row.lender.name}</TD>
                    <TD>{row.lender.type}</TD>
                    <TD>
                      <Chip tone={row.lender.status === 'Active' ? 'money' : 'neutral'}>
                        {row.lender.status}
                      </Chip>
                    </TD>
                    <TD align="right" className="tnum">
                      {row.files}
                    </TD>
                    <TD align="right" className="tnum">
                      {row.disbursed}
                    </TD>
                    <TD align="right" className="tnum">
                      {formatCurrency(row.volume)}
                    </TD>
                    <TD className="w-40">
                      <ProgressBar
                        value={row.approvalRate}
                        max={100}
                        tone={row.approvalRate >= 60 ? 'money' : 'warn'}
                        label={<span>{row.approvalRate}% approved</span>}
                      />
                    </TD>
                    <TD align="right" className="tnum whitespace-nowrap">
                      {row.lender.turnaroundDays}d
                    </TD>
                  </TR>
                ))}
              </TBody>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      <Card className="mt-3">
        <CardHeader
          title="Top advisors this cycle"
          subtitle="Ranked by payout earned inside the current filters"
          action={
            <Button variant="secondary" size="sm" icon={<Users className="size-3.5" />} loading={exporting} onClick={() => void exportReport()}>
              Export
            </Button>
          }
        />
        <CardBody>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {advisorRows.slice(0, 6).map(({ advisor, totalPayout, completed }, i) => (
              <li
                key={advisor.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
              >
                <span className="tnum flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-800">
                    {advisor.name}
                  </span>
                  <span className="block text-xs text-slate-500">{completed} files closed</span>
                </span>
                <span className="tnum shrink-0 text-[13px] font-semibold text-money-700">
                  {formatCompactCurrency(totalPayout)}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </>
  );
}
