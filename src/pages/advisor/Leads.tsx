import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, ListChecks, Pencil, Phone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { Chip, LeadStageBadge, StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/Misc';
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
import { APPLICATION_STATUSES, LEAD_STAGES, SERVICES } from '@/lib/constants';
import { formatCurrency, formatDate, matchesQuery } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';

export function Leads() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { applications, loading } = useData();

  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const mine = useMemo(
    () => applications.filter((a) => a.advisorId === user!.id),
    [applications, user],
  );

  const filtered = useMemo(() => {
    return mine
      .filter((a) =>
        matchesQuery(
          query,
          a.leadId,
          a.id,
          a.customer.fullName,
          a.customer.mobile,
          a.customer.email,
          a.customer.city,
        ),
      )
      .filter((a) => (stage ? a.leadStage === stage : true))
      .filter((a) => (status ? a.status === status : true))
      .filter((a) => (service ? a.service === service : true))
      .filter((a) => (from ? new Date(a.createdAt) >= new Date(from) : true))
      .filter((a) => (to ? new Date(a.createdAt) <= new Date(`${to}T23:59:59`) : true))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [mine, query, stage, status, service, from, to]);

  const activeFilters = [stage, status, service, from, to].filter(Boolean).length;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const resetFilters = () => {
    setStage('');
    setStatus('');
    setService('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every customer you have sourced, with the live processing state of their file."
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
              Add new lead
            </Button>
          </>
        }
      />

      <Card>
        <FilterBar
          query={query}
          onQueryChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Search by name, mobile, lead ID…"
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
            icon={<ListChecks className="size-5" />}
            title={mine.length ? 'No leads match these filters' : 'No leads yet'}
            description={
              mine.length
                ? 'Try widening the date range or clearing the status filter.'
                : 'Add your first customer and their application will start tracking here.'
            }
            action={
              mine.length ? (
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button icon={<Plus className="size-4" />} onClick={() => navigate('/app/leads/new')}>
                  Add new lead
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Lead ID</TH>
                  <TH>Customer</TH>
                  <TH>Mobile</TH>
                  <TH>Service</TH>
                  <TH align="right">Loan amount</TH>
                  <TH>Date</TH>
                  <TH>Lead stage</TH>
                  <TH>Application status</TH>
                  <TH>Processing</TH>
                  <TH align="right">Action</TH>
                </THead>
                <TBody>
                  {paged.map((lead) => (
                    <TR key={lead.id} onClick={() => navigate(`/app/leads/${lead.id}`)}>
                      <TD>
                        <span className="block font-medium text-slate-900">{lead.leadId}</span>
                        <span className="block text-xs text-slate-500">{lead.id}</span>
                      </TD>
                      <TD>
                        <span className="block font-medium text-slate-800">
                          {lead.customer.fullName}
                        </span>
                        <span className="block text-xs text-slate-500">{lead.customer.city}</span>
                      </TD>
                      <TD className="tnum whitespace-nowrap">{lead.customer.mobile}</TD>
                      <TD>{lead.service}</TD>
                      <TD align="right" className="tnum">
                        {lead.loanAmount ? formatCurrency(lead.loanAmount) : '—'}
                      </TD>
                      <TD className="whitespace-nowrap">{formatDate(lead.createdAt)}</TD>
                      <TD>
                        <LeadStageBadge stage={lead.leadStage} />
                      </TD>
                      <TD>
                        <StatusBadge status={lead.status} />
                      </TD>
                      <TD>
                        <Chip tone={lead.processingStage === 'Closed' ? 'neutral' : 'brand'}>
                          {lead.processingStage}
                        </Chip>
                      </TD>
                      <TD align="right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="View lead"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/leads/${lead.id}`);
                            }}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit lead"
                            disabled={!['Draft', 'Documents Required', 'Submitted'].includes(lead.status)}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/leads/new?edit=${lead.id}`);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <a
                            href={`tel:${lead.customer.mobile}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
                            aria-label="Call customer"
                          >
                            <Phone className="size-4" />
                          </a>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            </div>

            <MobileCardList className="lg:hidden">
              {paged.map((lead) => (
                <MobileRow
                  key={lead.id}
                  onClick={() => navigate(`/app/leads/${lead.id}`)}
                  title={lead.customer.fullName}
                  subtitle={`${lead.leadId} · ${lead.customer.mobile}`}
                  badge={<LeadStageBadge stage={lead.leadStage} />}
                  rows={[
                    { label: 'Service', value: lead.service },
                    { label: 'Status', value: lead.status },
                    {
                      label: 'Amount',
                      value: lead.loanAmount ? formatCurrency(lead.loanAmount) : '—',
                    },
                    { label: 'Created', value: formatDate(lead.createdAt) },
                    { label: 'Processing', value: lead.processingStage },
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
