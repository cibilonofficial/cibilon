import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CircleSlash,
  Cog,
  FileStack,
  Hourglass,
  Layers,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatSkeleton, TableSkeleton } from '@/components/ui/Feedback';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar, PageHeader } from '@/components/ui/Misc';
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
import { ServiceBars, StatusDonut, VolumeBars } from '@/components/charts/Charts';
import { advisorRollup, computeMetrics, monthlyTrend, serviceDistribution, statusDistribution } from '@/lib/metrics';
import { formatCompactCurrency, formatCurrency, relativeTime } from '@/lib/utils';
import { useData } from '@/store/DataContext';
import { comparisonProps, useMonthlyComparisons } from '@/hooks/useMonthlyComparisons';

export function AdminDashboard() {
  const comparisons = useMonthlyComparisons();
  const navigate = useNavigate();
  const { applications, documents, payouts, advisors, loading } = useData();

  const metrics = useMemo(
    () => computeMetrics(applications, documents, payouts),
    [applications, documents, payouts],
  );
  const distribution = useMemo(() => statusDistribution(applications), [applications]);
  const byService = useMemo(() => serviceDistribution(applications), [applications]);
  const trend = useMemo(() => monthlyTrend(applications, payouts), [applications, payouts]);

  const processing = applications.filter((a) =>
    ['Under Review', 'Processing', 'Submitted to Lender'].includes(a.status),
  ).length;
  const approved = applications.filter((a) => a.status === 'Approved').length;
  const disbursed = applications.filter((a) =>
    ['Disbursed', 'Completed'].includes(a.status),
  ).length;

  const queue = useMemo(
    () =>
      [...applications]
        .filter((a) => a.status !== 'Draft')
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        .slice(0, 7),
    [applications],
  );

  const topAdvisors = useMemo(
    () =>
      advisors
        .map((a) => ({ advisor: a, ...advisorRollup(a.id, applications, payouts) }))
        .sort((a, b) => b.totalPayout - a.totalPayout)
        .slice(0, 5),
    [advisors, applications, payouts],
  );

  return (
    <>
      <PageHeader
        title="Operations console"
        description={`${applications.length} applications across ${advisors.length} advisors · ${processing} in active processing`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/admin/advisors')}>
              Manage advisors
            </Button>
            <Button icon={<Wallet className="size-4" />} onClick={() => navigate('/admin/payouts')}>
              Payout run
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 9 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Total advisors"
              value={advisors.length}
              icon={<Users className="size-4" />}
              tone="brand"
              footnote={`${advisors.filter((a) => a.status === 'Active').length} active`}
              onClick={() => navigate('/admin/advisors')}
            />
            <StatCard
              label="Total leads"
              value={metrics.totalLeads}
              icon={<Layers className="size-4" />}
              tone="neutral"
              {...comparisonProps(comparisons?.leads)}
            />
            <StatCard
              label="Active applications"
              value={metrics.active}
              icon={<FileStack className="size-4" />}
              tone="info"
              onClick={() => navigate('/admin/applications?status=active')}
            />
            <StatCard
              label="Under processing"
              value={processing}
              icon={<Cog className="size-4" />}
              tone="info"
              footnote="With credit & lender desks"
            />
            <StatCard
              label="Approved"
              value={approved}
              icon={<BadgeCheck className="size-4" />}
              tone="money"
              onClick={() => navigate('/admin/applications?status=Approved')}
            />
            <StatCard
              label="Rejected"
              value={metrics.rejected}
              icon={<CircleSlash className="size-4" />}
              tone="danger"
              onClick={() => navigate('/admin/applications?status=Rejected')}
            />
            <StatCard
              label="Disbursed"
              value={disbursed}
              icon={<Banknote className="size-4" />}
              tone="money"
              footnote={`${formatCompactCurrency(metrics.disbursedVolume)} volume`}
            />
            <StatCard
              label="Pending payouts"
              value={formatCompactCurrency(metrics.pendingPayout)}
              icon={<Hourglass className="size-4" />}
              tone="warn"
              onClick={() => navigate('/admin/payouts?status=Pending')}
            />
            <StatCard
              label="Total payouts"
              value={formatCompactCurrency(metrics.totalPayout)}
              icon={<TrendingUp className="size-4" />}
              tone="money"
              footnote={`${formatCompactCurrency(metrics.paidPayout)} settled`}
              onClick={() => navigate('/admin/payouts')}
            />
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Portfolio volume" subtitle="Submissions vs disbursals, last six months" />
          <CardBody>
            <VolumeBars data={trend} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Status distribution" subtitle="All applications" />
          <CardBody>
            <StatusDonut data={distribution} total={applications.length} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Processing queue"
            subtitle="Most recently touched files across the network"
            action={
              <Link
                to="/admin/applications"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-900"
              >
                All applications
                <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : (
            <>
              <div className="hidden md:block">
                <TableWrap className="min-w-full">
                  <THead>
                    <TH>Application</TH>
                    <TH>Customer</TH>
                    <TH>Advisor</TH>
                    <TH>Service</TH>
                    <TH>Status</TH>
                    <TH>Assigned</TH>
                    <TH>Updated</TH>
                  </THead>
                  <TBody>
                    {queue.map((app) => (
                      <TR key={app.id} onClick={() => navigate(`/admin/applications/${app.id}`)}>
                        <TD className="font-medium text-slate-900">{app.id}</TD>
                        <TD>{app.customer.fullName}</TD>
                        <TD className="text-slate-600">{app.advisorName}</TD>
                        <TD>{app.service}</TD>
                        <TD>
                          <StatusBadge status={app.status} />
                        </TD>
                        <TD className="text-slate-600">{app.assignedTo}</TD>
                        <TD className="whitespace-nowrap text-slate-500">
                          {relativeTime(app.updatedAt)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </TableWrap>
              </div>

              <MobileCardList className="md:hidden">
                {queue.map((app) => (
                  <MobileRow
                    key={app.id}
                    onClick={() => navigate(`/admin/applications/${app.id}`)}
                    title={app.customer.fullName}
                    subtitle={`${app.id} · ${app.advisorName}`}
                    badge={<StatusBadge status={app.status} />}
                    rows={[
                      { label: 'Service', value: app.service },
                      { label: 'Updated', value: relativeTime(app.updatedAt) },
                    ]}
                  />
                ))}
              </MobileCardList>
            </>
          )}
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader title="Top advisors" subtitle="By payout generated" />
            <CardBody className="space-y-3">
              {topAdvisors.map((row, i) => (
                <div key={row.advisor.id} className="flex items-center gap-3">
                  <span className="tnum w-4 shrink-0 text-xs font-semibold text-slate-400">
                    {i + 1}
                  </span>
                  <Avatar name={row.advisor.name} color={row.advisor.avatarColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800">
                      {row.advisor.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {row.advisor.code} · {row.totalLeads} leads
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-[13px] font-semibold text-money-700">
                    {formatCurrency(row.totalPayout)}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Mix by service" subtitle="Application volume" />
            <CardBody>
              <ServiceBars data={byService} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
