import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Power, UserRoundCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/StatusBadge';
import { Avatar, PageHeader } from '@/components/ui/Misc';
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
import { useToast } from '@/components/ui/Toast';
import { advisorRollup } from '@/lib/metrics';
import { formatCompactCurrency, formatCurrency, matchesQuery } from '@/lib/utils';
import { useMockLoading } from '@/hooks/useMockLoading';
import { useData } from '@/store/DataContext';
import type { Advisor } from '@/types';

export function AdminAdvisors() {
  const navigate = useNavigate();
  const toast = useToast();
  const { advisors, applications, payouts, setAdvisorStatus } = useData();
  const loading = useMockLoading();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [toggling, setToggling] = useState<Advisor | null>(null);

  const rows = useMemo(
    () =>
      advisors
        .map((advisor) => ({ advisor, ...advisorRollup(advisor.id, applications, payouts) }))
        .filter(({ advisor }) =>
          matchesQuery(query, advisor.name, advisor.code, advisor.email, advisor.agency, advisor.city),
        )
        .filter(({ advisor }) => (status ? advisor.status === status : true))
        .sort((a, b) => b.totalPayout - a.totalPayout),
    [advisors, applications, payouts, query, status],
  );

  const totals = useMemo(
    () => ({
      total: advisors.length,
      active: advisors.filter((a) => a.status === 'Active').length,
      payout: payouts.reduce((sum, p) => sum + p.payoutAmount, 0),
      leads: applications.length,
    }),
    [advisors, payouts, applications],
  );

  const nextStatus = toggling?.status === 'Active' ? 'Inactive' : 'Active';

  const confirmToggle = () => {
    if (!toggling) return;
    setAdvisorStatus(toggling.id, nextStatus);
    toast.success(
      nextStatus === 'Active' ? 'Advisor activated' : 'Advisor deactivated',
      `${toggling.name} is now ${nextStatus.toLowerCase()}.`,
    );
    setToggling(null);
  };

  return (
    <>
      <PageHeader
        title="Advisors"
        description="The empanelled DSA network, with the volume and payout each partner has generated."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total advisors"
          value={totals.total}
          icon={<Users className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Active advisors"
          value={totals.active}
          icon={<UserRoundCheck className="size-4" />}
          tone="money"
        />
        <StatCard
          label="Leads sourced"
          value={totals.leads}
          icon={<Building2 className="size-4" />}
          tone="neutral"
        />
        <StatCard
          label="Payout generated"
          value={formatCompactCurrency(totals.payout)}
          icon={<Building2 className="size-4" />}
          tone="money"
        />
      </div>

      <Card className="mt-3">
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search by name, DSA code, agency or city…"
          selects={[
            {
              id: 'status',
              label: 'All account states',
              value: status,
              options: ['Active', 'Inactive', 'Suspended'],
              onChange: setStatus,
            },
          ]}
          onReset={() => setStatus('')}
          activeCount={status ? 1 : 0}
        />

        {loading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No advisors match"
            description="Try a different search term or clear the account-state filter."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Advisor</TH>
                  <TH>Contact</TH>
                  <TH align="right">Total leads</TH>
                  <TH align="right">Active</TH>
                  <TH align="right">Completed</TH>
                  <TH align="right">Total payout</TH>
                  <TH>Account status</TH>
                  <TH align="right">Action</TH>
                </THead>
                <TBody>
                  {rows.map(({ advisor, totalLeads, active, completed, totalPayout }) => (
                    <TR key={advisor.id} onClick={() => navigate(`/admin/advisors/${advisor.id}`)}>
                      <TD>
                        <span className="flex items-center gap-2.5">
                          <Avatar name={advisor.name} color={advisor.avatarColor} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">
                              {advisor.name}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {advisor.code} · {advisor.agency}
                            </span>
                          </span>
                        </span>
                      </TD>
                      <TD>
                        <span className="tnum block text-[13px] text-slate-700">
                          {advisor.mobile}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {advisor.city}
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
                      <TD align="right" className="tnum font-semibold text-money-700">
                        {formatCurrency(totalPayout)}
                      </TD>
                      <TD>
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
                      </TD>
                      <TD align="right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/advisors/${advisor.id}`);
                            }}
                          >
                            View
                          </Button>
                          <Button
                            variant={advisor.status === 'Active' ? 'ghost' : 'success'}
                            size="sm"
                            icon={<Power className="size-3.5" />}
                            onClick={(e) => {
                              e.stopPropagation();
                              setToggling(advisor);
                            }}
                          >
                            {advisor.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            </div>

            <MobileCardList className="lg:hidden">
              {rows.map(({ advisor, totalLeads, active, completed, totalPayout }) => (
                <MobileRow
                  key={advisor.id}
                  onClick={() => navigate(`/admin/advisors/${advisor.id}`)}
                  title={advisor.name}
                  subtitle={`${advisor.code} · ${advisor.agency}`}
                  badge={
                    <Chip tone={advisor.status === 'Active' ? 'money' : 'neutral'}>
                      {advisor.status}
                    </Chip>
                  }
                  rows={[
                    { label: 'Leads', value: totalLeads },
                    { label: 'Active', value: active },
                    { label: 'Completed', value: completed },
                    { label: 'Payout', value: formatCurrency(totalPayout) },
                  ]}
                />
              ))}
            </MobileCardList>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.status === 'Active' ? 'Deactivate this advisor?' : 'Activate this advisor?'}
        message={
          toggling?.status === 'Active'
            ? `${toggling?.name} will not be able to submit new leads. Files already in processing continue as normal.`
            : `${toggling?.name} will regain access to the advisor CRM and can submit new leads.`
        }
        confirmLabel={toggling?.status === 'Active' ? 'Deactivate' : 'Activate'}
        tone={toggling?.status === 'Active' ? 'danger' : 'primary'}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />
    </>
  );
}
