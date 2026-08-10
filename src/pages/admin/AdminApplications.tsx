import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, FilePlus2, FileStack, RefreshCw, UserCog } from 'lucide-react';
import { AssignStaffModal } from '@/components/crm/AssignStaffModal';
import { RequestDocumentModal } from '@/components/crm/RequestDocumentModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar, PageHeader, Tabs } from '@/components/ui/Misc';
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
import { useToast } from '@/components/ui/Toast';
import { APPLICATION_STATUSES, SERVICES } from '@/lib/constants';
import { ACTIVE_STATUSES, COMPLETED_STATUSES } from '@/lib/metrics';
import { formatCurrency, matchesQuery, relativeTime } from '@/lib/utils';
import { useMockLoading } from '@/hooks/useMockLoading';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import type { Application, ApplicationStatus } from '@/types';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'queue', label: 'Needs review' },
  { id: 'active', label: 'In processing' },
  { id: 'completed', label: 'Disbursed' },
  { id: 'rejected', label: 'Rejected' },
];

function inTab(app: Application, tab: string): boolean {
  switch (tab) {
    case 'queue':
      return ['Submitted', 'Under Review', 'Documents Required'].includes(app.status);
    case 'active':
      return ACTIVE_STATUSES.includes(app.status);
    case 'completed':
      return COMPLETED_STATUSES.includes(app.status);
    case 'rejected':
      return app.status === 'Rejected';
    default:
      return true;
  }
}

export function AdminApplications() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { applications, advisors, updateApplicationStatus } = useData();
  const loading = useMockLoading();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [advisorFilter, setAdvisorFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [target, setTarget] = useState<Application | null>(null);
  const [assigning, setAssigning] = useState<Application | null>(null);
  const [requesting, setRequesting] = useState<Application | null>(null);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus | ''>('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const param = searchParams.get('status');
    if (!param) return;
    if (param === 'active') setTab('active');
    else setStatus(param);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const advisorMap = useMemo(() => new Map(advisors.map((a) => [a.id, a])), [advisors]);

  const filtered = useMemo(
    () =>
      applications
        .filter((a) => inTab(a, tab))
        .filter((a) =>
          matchesQuery(query, a.id, a.customer.fullName, a.customer.mobile, a.advisorName, a.lender),
        )
        .filter((a) => (status ? a.status === status : true))
        .filter((a) => (service ? a.service === service : true))
        .filter((a) => (advisorFilter ? a.advisorName === advisorFilter : true))
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    [applications, tab, query, status, service, advisorFilter],
  );

  const counts = useMemo(
    () =>
      TABS.reduce<Record<string, number>>((acc, t) => {
        acc[t.id] = applications.filter((a) => inTab(a, t.id)).length;
        return acc;
      }, {}),
    [applications],
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeFilters = [status, service, advisorFilter].filter(Boolean).length;

  const saveStatus = async () => {
    if (!target || !nextStatus) return;
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    updateApplicationStatus(target.id, nextStatus, remarks, user!.name);
    setSaving(false);
    setTarget(null);
    setRemarks('');
    setNextStatus('');
    toast.success('Status updated', `${target.id} is now ${nextStatus}.`);
  };

  return (
    <>
      <PageHeader
        title="Applications"
        description="Every file submitted by the advisor network, with controls to move it through processing."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="size-4" />}
            onClick={() => toast.info('Export queued', 'The report will be emailed to you.')}
          >
            Export
          </Button>
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
          placeholder="Search by application, customer, advisor…"
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
          onReset={() => {
            setStatus('');
            setService('');
            setAdvisorFilter('');
            setPage(1);
          }}
          activeCount={activeFilters}
        />

        {loading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileStack className="size-5" />}
            title="No applications match"
            description="Try a different tab or clear the filters."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Application</TH>
                  <TH>Customer</TH>
                  <TH>Advisor</TH>
                  <TH>Service</TH>
                  <TH align="right">Amount</TH>
                  <TH>Lender</TH>
                  <TH>Status</TH>
                  <TH>Assigned</TH>
                  <TH>Updated</TH>
                  <TH align="right">Action</TH>
                </THead>
                <TBody>
                  {paged.map((app) => {
                    const advisor = advisorMap.get(app.advisorId);
                    return (
                      <TR key={app.id} onClick={() => navigate(`/admin/applications/${app.id}`)}>
                        <TD className="font-medium text-slate-900">{app.id}</TD>
                        <TD>
                          <span className="block font-medium text-slate-800">
                            {app.customer.fullName}
                          </span>
                          <span className="tnum block text-xs text-slate-500">
                            {app.customer.mobile}
                          </span>
                        </TD>
                        <TD>
                          <span className="flex items-center gap-2">
                            <Avatar
                              name={app.advisorName}
                              color={advisor?.avatarColor}
                              size="sm"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] text-slate-700">
                                {app.advisorName}
                              </span>
                              <span className="block text-xs text-slate-500">
                                {advisor?.code ?? '—'}
                              </span>
                            </span>
                          </span>
                        </TD>
                        <TD>{app.service}</TD>
                        <TD align="right" className="tnum">
                          {app.loanAmount ? formatCurrency(app.loanAmount) : '—'}
                        </TD>
                        <TD className="text-slate-600">{app.lender}</TD>
                        <TD>
                          <StatusBadge status={app.status} />
                        </TD>
                        <TD className="text-slate-600">{app.assignedTo}</TD>
                        <TD className="whitespace-nowrap text-slate-500">
                          {relativeTime(app.updatedAt)}
                        </TD>
                        <TD align="right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Assign ${app.id}`}
                              title="Assign to staff"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssigning(app);
                              }}
                            >
                              <UserCog className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Request a document for ${app.id}`}
                              title="Request a document"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRequesting(app);
                              }}
                            >
                              <FilePlus2 className="size-4" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<RefreshCw className="size-3.5" />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTarget(app);
                                setNextStatus(app.status);
                              }}
                            >
                              Update
                            </Button>
                          </div>
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
                  onClick={() => navigate(`/admin/applications/${app.id}`)}
                  title={app.customer.fullName}
                  subtitle={`${app.id} · ${app.advisorName}`}
                  badge={<StatusBadge status={app.status} />}
                  rows={[
                    { label: 'Service', value: app.service },
                    {
                      label: 'Amount',
                      value: app.loanAmount ? formatCurrency(app.loanAmount) : '—',
                    },
                    { label: 'Assigned', value: app.assignedTo },
                    { label: 'Updated', value: relativeTime(app.updatedAt) },
                  ]}
                  action={
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssigning(app);
                        }}
                      >
                        Assign
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTarget(app);
                          setNextStatus(app.status);
                        }}
                      >
                        Update status
                      </Button>
                    </>
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

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={target ? `Update status — ${target.id}` : ''}
        description={target ? `${target.customer.fullName} · ${target.advisorName}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveStatus} loading={saving} disabled={!nextStatus}>
              Save update
            </Button>
          </>
        }
      >
        {target && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="text-xs text-slate-500">Current</span>
              <StatusBadge status={target.status} />
            </div>
            <Select
              label="New status"
              required
              options={APPLICATION_STATUSES}
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as ApplicationStatus)}
            />
            <Textarea
              label="Processing remarks"
              rows={3}
              placeholder="What changed, and what does the advisor need to do next?"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            {(nextStatus === 'Disbursed' || nextStatus === 'Completed') && (
              <p className="rounded-lg border border-money-500/20 bg-money-50 px-3 py-2.5 text-[13px] text-money-700">
                A payout of {formatCurrency(target.expectedPayout)} will be raised for{' '}
                {target.advisorName}.
              </p>
            )}
          </div>
        )}
      </Modal>

      <AssignStaffModal application={assigning} onClose={() => setAssigning(null)} />
      <RequestDocumentModal application={requesting} onClose={() => setRequesting(null)} />
    </>
  );
}
