import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  Power,
  Users,
} from 'lucide-react';
import { PayoutTrend, ServiceBars } from '@/components/charts/Charts';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, DetailItem } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Avatar, PageHeader, ProgressBar, Tabs } from '@/components/ui/Misc';
import { StatCard } from '@/components/ui/StatCard';
import { Chip, PayoutBadge, StatusBadge, TicketBadge } from '@/components/ui/StatusBadge';
import { TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { ACTIVE_STATUSES, COMPLETED_STATUSES, monthlyTrend, serviceDistribution } from '@/lib/metrics';
import { formatCompactCurrency, formatCurrency, formatDate, relativeTime } from '@/lib/utils';
import { useData } from '@/store/DataContext';

export function AdminAdvisorDetails() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { advisors, applications, payouts, tickets, setAdvisorStatus } = useData();

  const [tab, setTab] = useState('applications');
  const [confirming, setConfirming] = useState(false);

  const advisor = advisors.find((a) => a.id === id);

  const mine = useMemo(
    () => applications.filter((a) => a.advisorId === id),
    [applications, id],
  );
  const minePayouts = useMemo(() => payouts.filter((p) => p.advisorId === id), [payouts, id]);
  const trend = useMemo(() => monthlyTrend(mine, minePayouts), [mine, minePayouts]);
  const myTickets = useMemo(() => tickets.filter((t) => t.advisorId === id), [tickets, id]);

  if (!advisor) {
    return (
      <Card>
        <EmptyState
          icon={<Users className="size-5" />}
          title="Advisor not found"
          description={`We could not find an advisor with the ID “${id}”.`}
          action={
            <Button variant="secondary" onClick={() => navigate('/admin/advisors')}>
              Back to advisors
            </Button>
          }
        />
      </Card>
    );
  }

  const completed = mine.filter((a) => COMPLETED_STATUSES.includes(a.status)).length;
  const decided = mine.filter((a) =>
    ['Approved', 'Rejected', 'Disbursed', 'Completed'].includes(a.status),
  );
  const stats = {
    leads: mine.length,
    active: mine.filter((a) => ACTIVE_STATUSES.includes(a.status)).length,
    completed,
    rejected: mine.filter((a) => a.status === 'Rejected').length,
    volume: mine
      .filter((a) => COMPLETED_STATUSES.includes(a.status))
      .reduce((sum, a) => sum + a.loanAmount, 0),
    payout: minePayouts.reduce((sum, p) => sum + p.payoutAmount, 0),
    paid: minePayouts.filter((p) => p.status === 'Paid').reduce((sum, p) => sum + p.payoutAmount, 0),
    pending: minePayouts
      .filter((p) => p.status !== 'Paid')
      .reduce((sum, p) => sum + p.payoutAmount, 0),
    approvalRate: decided.length
      ? Math.round((decided.filter((a) => a.status !== 'Rejected').length / decided.length) * 100)
      : 0,
  };

  const nextStatus = advisor.status === 'Active' ? 'Inactive' : 'Active';

  const confirmToggle = () => {
    setAdvisorStatus(advisor.id, nextStatus);
    toast.success(
      nextStatus === 'Active' ? 'Advisor activated' : 'Advisor deactivated',
      `${advisor.name} is now ${nextStatus.toLowerCase()}.`,
    );
    setConfirming(false);
  };

  return (
    <>
      <PageHeader
        breadcrumb={
          <nav className="mb-1.5 flex items-center gap-1 text-xs text-slate-500">
            <Link to="/admin/advisors" className="hover:text-slate-800">
              Advisors
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-slate-700">{advisor.code}</span>
          </nav>
        }
        title={advisor.name}
        description={`${advisor.agency} · empanelled ${formatDate(advisor.joinedOn)}`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate('/admin/advisors')}
            >
              Back
            </Button>
            <Button
              variant={advisor.status === 'Active' ? 'danger' : 'success'}
              icon={<Power className="size-4" />}
              onClick={() => setConfirming(true)}
            >
              {advisor.status === 'Active' ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        }
      />

      {/* `min-w-0` on both columns: without it the tables below refuse to
          shrink and the grid track pushes the page wider than the viewport. */}
      <div className="grid gap-3 lg:grid-cols-[20rem_1fr]">
        <div className="min-w-0 space-y-3">
          <Card>
            <CardBody className="text-center">
              <Avatar name={advisor.name} color={advisor.avatarColor} size="xl" className="mx-auto" />
              <h2 className="mt-3 text-base font-semibold text-slate-900">{advisor.name}</h2>
              <p className="text-[13px] text-slate-500">{advisor.agency}</p>
              <div className="mt-3 flex justify-center gap-1.5">
                <Chip tone="brand">{advisor.code}</Chip>
                <Chip
                  tone={
                    advisor.status === 'Active'
                      ? 'money'
                      : advisor.status === 'Inactive'
                        ? 'neutral'
                        : 'danger'
                  }
                >
                  {advisor.status}
                </Chip>
              </div>

              <dl className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-left">
                <DetailItem
                  label="Email"
                  value={
                    <span className="flex items-center gap-1.5">
                      <Mail className="size-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{advisor.email}</span>
                    </span>
                  }
                />
                <DetailItem
                  label="Mobile"
                  value={
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3.5 text-slate-400" />
                      {advisor.mobile}
                    </span>
                  }
                />
                <DetailItem
                  label="City"
                  value={
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-slate-400" />
                      {advisor.city}
                    </span>
                  }
                />
                <DetailItem
                  label="Agency"
                  value={
                    <span className="flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-slate-400" />
                      {advisor.agency}
                    </span>
                  }
                />
                <DetailItem label="Empanelled on" value={formatDate(advisor.joinedOn)} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Conversion" subtitle="Closed against total sourced" />
            <CardBody className="space-y-4">
              <ProgressBar
                value={stats.completed}
                max={Math.max(1, stats.leads)}
                tone="money"
                label={
                  <span>
                    {stats.completed}/{stats.leads} files closed
                  </span>
                }
              />
              <ProgressBar
                value={stats.approvalRate}
                max={100}
                tone={stats.approvalRate >= 60 ? 'money' : 'warn'}
                label={<span>Approval rate</span>}
              />
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Leads sourced" value={stats.leads} icon={<Users className="size-4" />} tone="brand" />
            <StatCard
              label="Disbursed volume"
              value={formatCompactCurrency(stats.volume)}
              icon={<Building2 className="size-4" />}
              tone="money"
            />
            <StatCard
              label="Payout earned"
              value={formatCompactCurrency(stats.payout)}
              icon={<Building2 className="size-4" />}
              tone="money"
              footnote={`${formatCompactCurrency(stats.paid)} released`}
            />
            <StatCard
              label="Pending payout"
              value={formatCompactCurrency(stats.pending)}
              icon={<Building2 className="size-4" />}
              tone="warn"
            />
          </div>

          <Card>
            <div className="px-4 pt-1 sm:px-5">
              <Tabs
                tabs={[
                  { id: 'applications', label: 'Applications', count: mine.length },
                  { id: 'payouts', label: 'Payouts', count: minePayouts.length },
                  { id: 'performance', label: 'Performance' },
                  { id: 'support', label: 'Support', count: myTickets.length },
                ]}
                active={tab}
                onChange={setTab}
              />
            </div>

            {tab === 'applications' &&
              (mine.length === 0 ? (
                <EmptyState
                  icon={<Users className="size-5" />}
                  title="No applications yet"
                  description="Files this advisor sources will be listed here."
                />
              ) : (
                <TableWrap className="min-w-full">
                  <THead>
                    <TH>Application</TH>
                    <TH>Customer</TH>
                    <TH>Service</TH>
                    <TH align="right">Amount</TH>
                    <TH>Lender</TH>
                    <TH>Status</TH>
                    <TH>Updated</TH>
                    <TH align="right">Payout</TH>
                  </THead>
                  <TBody>
                    {mine.map((app) => (
                      <TR key={app.id} onClick={() => navigate(`/admin/applications/${app.id}`)}>
                        <TD className="font-medium text-slate-900">{app.id}</TD>
                        <TD>{app.customer.fullName}</TD>
                        <TD>{app.service}</TD>
                        <TD align="right" className="tnum">
                          {app.loanAmount ? formatCurrency(app.loanAmount) : '—'}
                        </TD>
                        <TD className="text-slate-600">{app.lender}</TD>
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
                    ))}
                  </TBody>
                </TableWrap>
              ))}

            {tab === 'payouts' &&
              (minePayouts.length === 0 ? (
                <EmptyState
                  icon={<Building2 className="size-5" />}
                  title="No payouts raised"
                  description="Payouts appear once one of their files is disbursed."
                />
              ) : (
                <TableWrap className="min-w-full">
                  <THead>
                    <TH>Payout</TH>
                    <TH>Customer</TH>
                    <TH>Service</TH>
                    <TH>Disbursed</TH>
                    <TH align="right">Loan amount</TH>
                    <TH align="right">Payout</TH>
                    <TH>Status</TH>
                    <TH>UTR</TH>
                  </THead>
                  <TBody>
                    {minePayouts.map((p) => (
                      <TR key={p.id}>
                        <TD className="font-medium text-slate-900">{p.applicationId}</TD>
                        <TD>{p.customerName}</TD>
                        <TD>{p.service}</TD>
                        <TD className="whitespace-nowrap">{formatDate(p.disbursementDate)}</TD>
                        <TD align="right" className="tnum">
                          {p.loanAmount ? formatCurrency(p.loanAmount) : '—'}
                        </TD>
                        <TD align="right" className="tnum font-semibold text-money-700">
                          {formatCurrency(p.payoutAmount)}
                        </TD>
                        <TD>
                          <PayoutBadge status={p.status} />
                        </TD>
                        <TD className="font-mono text-xs text-slate-500">{p.utr ?? '—'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </TableWrap>
              ))}

            {tab === 'performance' && (
              <CardBody className="grid gap-3 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Mix by service" />
                  <CardBody>
                    <ServiceBars data={serviceDistribution(mine)} />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Payout trend" subtitle="Rolling six months (network view)" />
                  <CardBody>
                    <PayoutTrend data={trend} />
                  </CardBody>
                </Card>
              </CardBody>
            )}

            {tab === 'support' &&
              (myTickets.length === 0 ? (
                <EmptyState
                  icon={<Users className="size-5" />}
                  title="No support tickets"
                  description="Nothing has been raised by this advisor."
                />
              ) : (
                <CardBody>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {myTickets.map((ticket) => (
                      <li key={ticket.id} className="flex items-start justify-between gap-3 px-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-slate-800">
                            {ticket.subject}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {ticket.id} · {ticket.category} · updated {relativeTime(ticket.updatedAt)}
                          </p>
                        </div>
                        <TicketBadge status={ticket.status} />
                      </li>
                    ))}
                  </ul>
                </CardBody>
              ))}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title={advisor.status === 'Active' ? 'Deactivate this advisor?' : 'Activate this advisor?'}
        message={
          advisor.status === 'Active'
            ? `${advisor.name} will not be able to submit new leads. Files already in processing continue as normal.`
            : `${advisor.name} will regain access to the advisor CRM and can submit new leads.`
        }
        confirmLabel={advisor.status === 'Active' ? 'Deactivate' : 'Activate'}
        tone={advisor.status === 'Active' ? 'danger' : 'primary'}
        onConfirm={confirmToggle}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
