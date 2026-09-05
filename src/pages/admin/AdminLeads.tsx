import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ListChecks, UserCog } from 'lucide-react';
import { AssignStaffModal } from '@/components/crm/AssignStaffModal';
import { FilterBar } from '@/components/crm/FilterBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { Avatar, PageHeader, Tabs } from '@/components/ui/Misc';
import { Pagination } from '@/components/ui/Pagination';
import { StatCard } from '@/components/ui/StatCard';
import { LeadStageBadge, StatusBadge } from '@/components/ui/StatusBadge';
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
import { APPLICATION_STATUSES, LEAD_STAGES, SERVICES } from '@/lib/constants';
import { formatCurrency, formatDate, matchesQuery, relativeTime } from '@/lib/utils';
import { useData } from '@/store/DataContext';
import type { Application, LeadStage } from '@/types';

const TABS = [
  { id: 'all', label: 'All leads' },
  { id: 'open', label: 'Open' },
  { id: 'Documents Pending', label: 'Documents pending' },
  { id: 'Converted', label: 'Converted' },
  { id: 'Dropped', label: 'Dropped' },
];

function inTab(lead: Application, tab: string): boolean {
  if (tab === 'all') return true;
  if (tab === 'open') return ['New', 'Contacted', 'Qualified'].includes(lead.leadStage);
  return lead.leadStage === tab;
}

export function AdminLeads() {
  const navigate = useNavigate();
  const toast = useToast();
  const { applications, advisors, updateLeadStage, loading } = useData();

  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  const [advisorFilter, setAdvisorFilter] = useState('');
  const [service, setService] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [assigning, setAssigning] = useState<Application | null>(null);

  const advisorMap = useMemo(() => new Map(advisors.map((a) => [a.id, a])), [advisors]);

  const filtered = useMemo(
    () =>
      applications
        .filter((a) => inTab(a, tab))
        .filter((a) =>
          matchesQuery(
            query,
            a.leadId,
            a.id,
            a.customer.fullName,
            a.customer.mobile,
            a.customer.email,
            a.customer.city,
            a.advisorName,
          ),
        )
        .filter((a) => (stage ? a.leadStage === stage : true))
        .filter((a) => (status ? a.status === status : true))
        .filter((a) => (advisorFilter ? a.advisorName === advisorFilter : true))
        .filter((a) => (service ? a.service === service : true))
        .filter((a) => (from ? new Date(a.createdAt) >= new Date(from) : true))
        .filter((a) => (to ? new Date(a.createdAt) <= new Date(`${to}T23:59:59`) : true))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [applications, tab, query, stage, status, advisorFilter, service, from, to],
  );

  const counts = useMemo(
    () =>
      TABS.reduce<Record<string, number>>((acc, t) => {
        acc[t.id] = applications.filter((a) => inTab(a, t.id)).length;
        return acc;
      }, {}),
    [applications],
  );

  const totals = useMemo(() => {
    const converted = applications.filter((a) => a.leadStage === 'Converted').length;
    return {
      total: applications.length,
      open: applications.filter((a) => ['New', 'Contacted', 'Qualified'].includes(a.leadStage))
        .length,
      converted,
      conversion: applications.length
        ? Math.round((converted / applications.length) * 100)
        : 0,
    };
  }, [applications]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeFilters = [stage, status, advisorFilter, service, from, to].filter(Boolean).length;

  const resetFilters = () => {
    setStage('');
    setStatus('');
    setAdvisorFilter('');
    setService('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const changeStage = (lead: Application, next: LeadStage) => {
    updateLeadStage(lead.id, next);
    toast.success('Lead stage updated', `${lead.leadId} is now ${next}.`);
  };

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every lead sourced by the advisor network, from first contact through to conversion."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="size-4" />}
            onClick={() => toast.info('Export queued', 'The lead report will be emailed to you.')}
          >
            Export
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total leads"
          value={totals.total}
          icon={<ListChecks className="size-4" />}
          tone="brand"
          onClick={() => setTab('all')}
        />
        <StatCard
          label="Open pipeline"
          value={totals.open}
          icon={<ListChecks className="size-4" />}
          tone="info"
          onClick={() => setTab('open')}
        />
        <StatCard
          label="Converted"
          value={totals.converted}
          icon={<ListChecks className="size-4" />}
          tone="money"
          onClick={() => setTab('Converted')}
        />
        <StatCard
          label="Conversion rate"
          value={`${totals.conversion}%`}
          icon={<ListChecks className="size-4" />}
          tone="neutral"
          footnote="Leads that reached disbursal"
        />
      </div>

      <Card className="mt-3">
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
          placeholder="Search by lead ID, customer, mobile or advisor…"
          selects={[
            {
              id: 'stage',
              label: 'All stages',
              value: stage,
              options: LEAD_STAGES,
              onChange: (v) => {
                setStage(v);
                setPage(1);
              },
            },
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
              id: 'advisor',
              label: 'All advisors',
              value: advisorFilter,
              options: advisors.map((a) => a.name),
              onChange: (v) => {
                setAdvisorFilter(v);
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
          <TableSkeleton rows={8} cols={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="size-5" />}
            title="No leads match these filters"
            description="Try widening the date range or clearing the stage filter."
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
                  <TH>Lead</TH>
                  <TH>Customer</TH>
                  <TH>Advisor</TH>
                  <TH>Service</TH>
                  <TH align="right">Amount</TH>
                  <TH>Created</TH>
                  <TH>Stage</TH>
                  <TH>Application</TH>
                  <TH>Assigned</TH>
                  <TH align="right">Action</TH>
                </THead>
                <TBody>
                  {paged.map((lead) => {
                    const advisor = advisorMap.get(lead.advisorId);
                    return (
                      <TR key={lead.id} onClick={() => navigate(`/admin/leads/${lead.id}`)}>
                        <TD>
                          <span className="block font-medium text-slate-900">{lead.leadId}</span>
                          <span className="block text-xs text-slate-500">{lead.id}</span>
                        </TD>
                        <TD>
                          <span className="block font-medium text-slate-800">
                            {lead.customer.fullName}
                          </span>
                          <span className="tnum block text-xs text-slate-500">
                            {lead.customer.mobile}
                          </span>
                        </TD>
                        <TD>
                          <span className="flex items-center gap-2">
                            <Avatar name={lead.advisorName} color={advisor?.avatarColor} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] text-slate-700">
                                {lead.advisorName}
                              </span>
                              <span className="block text-xs text-slate-500">
                                {advisor?.code ?? '—'}
                              </span>
                            </span>
                          </span>
                        </TD>
                        <TD>{lead.service}</TD>
                        <TD align="right" className="tnum">
                          {lead.loanAmount ? formatCurrency(lead.loanAmount) : '—'}
                        </TD>
                        <TD className="whitespace-nowrap">{formatDate(lead.createdAt)}</TD>
                        <TD onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.leadStage}
                            onChange={(e) => changeStage(lead, e.target.value as LeadStage)}
                            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-700 focus:border-brand-500 focus:outline-none"
                          >
                            {LEAD_STAGES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </TD>
                        <TD>
                          <StatusBadge status={lead.status} />
                        </TD>
                        <TD className="text-slate-600">{lead.assignedTo}</TD>
                        <TD align="right">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<UserCog className="size-3.5" />}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssigning(lead);
                            }}
                          >
                            Assign
                          </Button>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </TableWrap>
            </div>

            <MobileCardList className="lg:hidden">
              {paged.map((lead) => (
                <MobileRow
                  key={lead.id}
                  onClick={() => navigate(`/admin/leads/${lead.id}`)}
                  title={lead.customer.fullName}
                  subtitle={`${lead.leadId} · ${lead.advisorName}`}
                  badge={<LeadStageBadge stage={lead.leadStage} />}
                  rows={[
                    { label: 'Service', value: lead.service },
                    {
                      label: 'Amount',
                      value: lead.loanAmount ? formatCurrency(lead.loanAmount) : '—',
                    },
                    { label: 'Created', value: formatDate(lead.createdAt) },
                    { label: 'Updated', value: relativeTime(lead.updatedAt) },
                  ]}
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssigning(lead);
                      }}
                    >
                      Assign
                    </Button>
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

      <AssignStaffModal application={assigning} onClose={() => setAssigning(null)} />
    </>
  );
}
