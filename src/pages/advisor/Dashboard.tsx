import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CircleSlash,
  FileClock,
  FileStack,
  FileWarning,
  Hourglass,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, StatSkeleton, TableSkeleton } from '@/components/ui/Feedback';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader, ProgressBar } from '@/components/ui/Misc';
import { TBody, TD, TH, THead, TR, TableWrap, MobileCardList, MobileRow } from '@/components/ui/Table';
import { PayoutTrend, StatusDonut, VolumeBars } from '@/components/charts/Charts';
import { computeMetrics, monthlyTrend, statusDistribution } from '@/lib/metrics';
import { formatCompactCurrency, formatCurrency, formatDate, relativeTime } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { comparisonProps, useMonthlyComparisons } from '@/hooks/useMonthlyComparisons';

export function AdvisorDashboard() {
  const comparisons = useMonthlyComparisons();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { applications, documents, payouts, notifications, loading } = useData();

  const advisorId = user!.id;
  const mine = useMemo(
    () => applications.filter((a) => a.advisorId === advisorId),
    [applications, advisorId],
  );
  const metrics = useMemo(
    () => computeMetrics(mine, documents, payouts),
    [mine, documents, payouts],
  );
  const distribution = useMemo(() => statusDistribution(mine), [mine]);
  const trend = useMemo(() => monthlyTrend(mine, payouts.filter((p) => p.advisorId === advisorId)), [mine, payouts, advisorId]);

  const recent = useMemo(
    () => [...mine].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 6),
    [mine],
  );

  const actionItems = useMemo(
    () =>
      mine.filter(
        (a) =>
          a.status === 'Documents Required' ||
          a.status === 'Additional Information Required' ||
          a.status === 'Draft',
      ),
    [mine],
  );

  const unread = notifications.filter((n) => n.audience === 'advisor' && !n.read);
  const firstName = user!.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description={`${metrics.active} active applications · ${unread.length} unread updates · last sync ${relativeTime(new Date().toISOString())}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/app/applications')}>
              View applications
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={() => navigate('/app/leads/new')}>
              Add new lead
            </Button>
          </>
        }
      />

      {/* Stat grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Total leads"
              value={metrics.totalLeads}
              icon={<Users className="size-4" />}
              tone="brand"
              {...comparisonProps(comparisons?.leads)}
              onClick={() => navigate('/app/leads')}
            />
            <StatCard
              label="Active applications"
              value={metrics.active}
              icon={<FileStack className="size-4" />}
              tone="info"
              footnote="In processing across lenders"
              onClick={() => navigate('/app/applications?status=active')}
            />
            <StatCard
              label="Applications approved"
              value={metrics.approved}
              icon={<BadgeCheck className="size-4" />}
              tone="money"
              {...comparisonProps(comparisons?.approved)}
              onClick={() => navigate('/app/applications?status=Approved')}
            />
            <StatCard
              label="Applications rejected"
              value={metrics.rejected}
              icon={<CircleSlash className="size-4" />}
              tone="danger"
              {...comparisonProps(comparisons?.rejected)}
              lowerIsBetter
              onClick={() => navigate('/app/applications?status=Rejected')}
            />
            <StatCard
              label="Pending documents"
              value={metrics.pendingDocuments}
              icon={<FileWarning className="size-4" />}
              tone="warn"
              footnote="Awaiting your upload"
              onClick={() => navigate('/app/documents')}
            />
            <StatCard
              label="Total payout"
              value={formatCompactCurrency(metrics.totalPayout)}
              icon={<Wallet className="size-4" />}
              tone="money"
              footnote={`${formatCompactCurrency(metrics.paidPayout)} already credited`}
              onClick={() => navigate('/app/payouts')}
            />
            <StatCard
              label="Pending payout"
              value={formatCompactCurrency(metrics.pendingPayout)}
              icon={<Hourglass className="size-4" />}
              tone="warn"
              footnote="Releases with the next cycle"
              onClick={() => navigate('/app/payouts?status=Pending')}
            />
            <StatCard
              label="Disbursed volume"
              value={formatCompactCurrency(metrics.disbursedVolume)}
              icon={<TrendingUp className="size-4" />}
              tone="neutral"
              footnote={`${metrics.approvalRate}% approval rate`}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Submissions vs disbursals"
            subtitle="Last six months of your pipeline"
          />
          <CardBody>
            <VolumeBars data={trend} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Application status" subtitle="Live split across your book" />
          <CardBody>
            <StatusDonut data={distribution} total={mine.length} />
          </CardBody>
        </Card>
      </div>

      {/* Action items + payout trend */}
      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent applications"
            subtitle="Sorted by the latest update from the ops desk"
            action={
              <Link
                to="/app/applications"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-900"
              >
                View all
                <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<FileStack className="size-5" />}
              title="No applications yet"
              description="Add your first lead and it will show up here as soon as it is submitted."
              action={
                <Button icon={<Plus className="size-4" />} onClick={() => navigate('/app/leads/new')}>
                  Add new lead
                </Button>
              }
            />
          ) : (
            <>
              <div className="hidden md:block">
                <TableWrap>
                  <THead>
                    <TH>Application ID</TH>
                    <TH>Customer</TH>
                    <TH>Service</TH>
                    <TH>Submitted</TH>
                    <TH>Status</TH>
                    <TH align="right">Expected payout</TH>
                    <TH align="right">Action</TH>
                  </THead>
                  <TBody>
                    {recent.map((app) => (
                      <TR key={app.id} onClick={() => navigate(`/app/applications/${app.id}`)}>
                        <TD className="font-medium text-slate-900">{app.id}</TD>
                        <TD>
                          <span className="block font-medium text-slate-800">
                            {app.customer.fullName}
                          </span>
                          <span className="block text-xs text-slate-500">{app.customer.city}</span>
                        </TD>
                        <TD>{app.service}</TD>
                        <TD className="whitespace-nowrap">{formatDate(app.submittedAt)}</TD>
                        <TD>
                          <StatusBadge status={app.status} />
                        </TD>
                        <TD align="right" className="tnum font-medium text-slate-900">
                          {formatCurrency(app.expectedPayout)}
                        </TD>
                        <TD align="right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/applications/${app.id}`);
                            }}
                          >
                            View
                          </Button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </TableWrap>
              </div>

              <MobileCardList className="md:hidden">
                {recent.map((app) => (
                  <MobileRow
                    key={app.id}
                    onClick={() => navigate(`/app/applications/${app.id}`)}
                    title={app.customer.fullName}
                    subtitle={`${app.id} · ${app.service}`}
                    badge={<StatusBadge status={app.status} />}
                    rows={[
                      { label: 'Submitted', value: formatDate(app.submittedAt) },
                      { label: 'Payout', value: formatCurrency(app.expectedPayout) },
                    ]}
                  />
                ))}
              </MobileCardList>
            </>
          )}
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader title="Needs your attention" subtitle={`${actionItems.length} open item(s)`} />
            <CardBody className="space-y-2.5">
              {actionItems.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Nothing pending. Well played.
                </p>
              ) : (
                actionItems.slice(0, 4).map((app) => (
                  <Link
                    key={app.id}
                    to={`/app/applications/${app.id}`}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <FileClock className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-800">
                        {app.customer.fullName} · {app.id}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-slate-500">
                        {app.requiredActions[0] ??
                          app.adminRemarks ??
                          'Complete and submit this application.'}
                      </span>
                    </span>
                    <StatusBadge status={app.status} className="shrink-0" />
                  </Link>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payout trend" subtitle="Rolling six-month earnings" />
            <CardBody>
              <PayoutTrend data={trend} />
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <ProgressBar
                  value={metrics.paidPayout}
                  max={Math.max(1, metrics.totalPayout)}
                  tone="money"
                  label={
                    <span>
                      Credited {formatCompactCurrency(metrics.paidPayout)} of{' '}
                      {formatCompactCurrency(metrics.totalPayout)}
                    </span>
                  }
                />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
