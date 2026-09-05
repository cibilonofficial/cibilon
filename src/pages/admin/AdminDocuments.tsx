import { Fragment, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Eye, FileSearch, FileText, XCircle } from 'lucide-react';
import { DocumentPreviewModal } from '@/components/crm/DocumentPreviewModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { FileTypeIcon } from '@/components/ui/FileUpload';
import { DocStatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { Pagination } from '@/components/ui/Pagination';
import { StatCard } from '@/components/ui/StatCard';
import {
  MobileCardList,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableWrap,
} from '@/components/ui/Table';
import { FilterBar } from '@/components/crm/FilterBar';
import { useToast } from '@/components/ui/Toast';
import { DOCUMENT_STATUSES } from '@/lib/constants';
import { formatBytes, formatDate, matchesQuery } from '@/lib/utils';
import { useData } from '@/store/DataContext';
import type { AppDocument } from '@/types';

const TABS = [
  { id: 'queue', label: 'Verification queue' },
  { id: 'all', label: 'All documents' },
  { id: 'Verified', label: 'Verified' },
  { id: 'Rejected', label: 'Rejected' },
];

export function AdminDocuments() {
  const toast = useToast();
  const { documents, applications, setDocumentStatus, loading } = useData();

  const [tab, setTab] = useState('queue');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [previewing, setPreviewing] = useState<AppDocument | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const appMap = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications]);

  const counts = useMemo(
    () => ({
      queue: documents.filter((d) => ['Uploaded', 'Under Verification'].includes(d.status)).length,
      all: documents.length,
      Verified: documents.filter((d) => d.status === 'Verified').length,
      Rejected: documents.filter((d) =>
        ['Rejected', 'Re-upload Required'].includes(d.status),
      ).length,
    }),
    [documents],
  );

  const filtered = useMemo(
    () =>
      documents
        .filter((d) => {
          if (tab === 'queue') return ['Uploaded', 'Under Verification'].includes(d.status);
          if (tab === 'Verified') return d.status === 'Verified';
          if (tab === 'Rejected') return ['Rejected', 'Re-upload Required'].includes(d.status);
          return true;
        })
        .filter((d) =>
          matchesQuery(
            query,
            d.applicationId,
            d.name,
            d.fileName,
            appMap.get(d.applicationId)?.customer.fullName,
            appMap.get(d.applicationId)?.advisorName,
          ),
        )
        .filter((d) => (status ? d.status === status : true))
        .sort((a, b) => +new Date(b.uploadedAt ?? 0) - +new Date(a.uploadedAt ?? 0)),
    [documents, tab, query, status, appMap],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, AppDocument[]>();
    filtered.forEach((doc) => groups.set(doc.applicationId, [...(groups.get(doc.applicationId) ?? []), doc]));
    return [...groups.entries()].map(([applicationId, items]) => ({
      applicationId,
      application: appMap.get(applicationId),
      documents: items,
      latestUpload: Math.max(...items.map((doc) => +new Date(doc.uploadedAt ?? 0))),
    })).sort((a, b) => b.latestUpload - a.latestUpload);
  }, [filtered, appMap]);

  const paged = grouped.slice((page - 1) * pageSize, page * pageSize);

  const verify = async (doc: AppDocument) => {
    try {
      await setDocumentStatus(doc.id, 'Verified', '');
      toast.success('Document verified', `${doc.name} for ${appMap.get(doc.applicationId)?.customer.fullName ?? doc.applicationId}`);
    } catch (error) {
      toast.error('Verification failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <>
      <PageHeader
        title="Document verification"
        description="Every document across the advisor network, and the desk controls to clear or bounce them."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="In queue"
          value={counts.queue}
          icon={<FileSearch className="size-4" />}
          tone="warn"
          onClick={() => setTab('queue')}
        />
        <StatCard
          label="Total documents"
          value={counts.all}
          icon={<FileText className="size-4" />}
          tone="brand"
          onClick={() => setTab('all')}
        />
        <StatCard
          label="Verified"
          value={counts.Verified}
          icon={<CheckCircle2 className="size-4" />}
          tone="money"
          onClick={() => setTab('Verified')}
        />
        <StatCard
          label="Bounced back"
          value={counts.Rejected}
          icon={<XCircle className="size-4" />}
          tone="danger"
          onClick={() => setTab('Rejected')}
        />
      </div>

      <Card className="mt-3">
        <div className="px-4 pt-1 sm:px-5">
          <Tabs
            tabs={TABS.map((t) => ({ ...t, count: counts[t.id as keyof typeof counts] }))}
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
          placeholder="Search by application, customer, advisor or document…"
          selects={[
            {
              id: 'status',
              label: 'All statuses',
              value: status,
              options: DOCUMENT_STATUSES,
              onChange: (v) => {
                setStatus(v);
                setPage(1);
              },
            },
          ]}
          onReset={() => {
            setStatus('');
            setPage(1);
          }}
          activeCount={status ? 1 : 0}
        />

        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={<FileSearch className="size-5" />}
            title="Queue is clear"
            description="No documents are waiting on the verification desk in this view."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Lead / Application</TH>
                  <TH>Advisor</TH>
                  <TH>Service</TH>
                  <TH align="right">Documents</TH>
                  <TH>Progress</TH>
                  <TH align="right">Open</TH>
                </THead>
                <TBody>
                  {paged.map((group) => {
                    const app = group.application;
                    const open = expandedId === group.applicationId;
                    const verifiedCount = group.documents.filter((doc) => doc.status === 'Verified').length;
                    return (
                      <Fragment key={group.applicationId}>
                        <TR onClick={() => setExpandedId(open ? null : group.applicationId)}>
                          <TD>
                            <span className="flex items-center gap-2.5">
                              {open ? <ChevronDown className="size-4 text-brand-600" /> : <ChevronRight className="size-4 text-slate-400" />}
                              <span>
                                <span className="block font-semibold text-slate-900">{app?.customer.fullName ?? 'Unknown lead'}</span>
                                <span className="block text-xs text-brand-700">{group.applicationId}</span>
                              </span>
                            </span>
                          </TD>
                          <TD>{app?.advisorName ?? '—'}</TD>
                          <TD>{app?.service ?? '—'}</TD>
                          <TD align="right" className="tnum font-medium">{group.documents.length}</TD>
                          <TD><span className="text-sm text-slate-600">{verifiedCount} verified · {group.documents.length - verifiedCount} pending</span></TD>
                          <TD align="right"><Button variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); setExpandedId(open ? null : group.applicationId); }}>{open ? 'Close' : 'View documents'}</Button></TD>
                        </TR>
                        {open && <TR className="bg-slate-50/70">
                          <TD colSpan={6} className="p-0">
                            <div className="divide-y divide-slate-200 border-y border-slate-200">
                              {group.documents.map((doc) => <div key={doc.id} className="grid grid-cols-[minmax(220px,1fr)_150px_130px_auto] items-center gap-4 px-8 py-3">
                                <span className="flex min-w-0 items-center gap-2"><FileTypeIcon fileType={doc.fileType} /><span className="min-w-0"><span className="block font-medium text-slate-800">{doc.name}</span><span className="block truncate text-xs text-slate-500">{doc.fileName ? `${doc.fileName} · ${formatBytes(doc.size)}` : 'Not uploaded'}</span></span></span>
                                <span className="text-xs text-slate-500">{formatDate(doc.uploadedAt)}</span>
                                <DocStatusBadge status={doc.status} />
                                <span className="flex justify-end gap-1.5"><Button variant="ghost" size="sm" icon={<Eye className="size-3.5" />} onClick={() => setPreviewing(doc)}>Preview</Button><Button variant="success" size="sm" disabled={!doc.fileName || doc.status === 'Verified'} onClick={() => void verify(doc)}>Verify</Button><Button variant="secondary" size="sm" disabled={!doc.fileName} onClick={() => setPreviewing(doc)}>Bounce</Button></span>
                              </div>)}
                            </div>
                          </TD>
                        </TR>}
                      </Fragment>
                    );
                  })}
                </TBody>
              </TableWrap>
            </div>

            <MobileCardList className="lg:hidden">
              {paged.map((group) => {
                const open = expandedId === group.applicationId;
                return <div key={group.applicationId} className="px-4 py-4">
                  <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setExpandedId(open ? null : group.applicationId)}>
                    <span><span className="block font-semibold text-slate-900">{group.application?.customer.fullName ?? 'Unknown lead'}</span><span className="mt-0.5 block text-xs text-brand-700">{group.applicationId}</span><span className="mt-1 block text-xs text-slate-500">{group.documents.length} documents · {group.application?.advisorName ?? '—'}</span></span>
                    {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>
                  {open && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">{group.documents.map((doc) => <button type="button" key={doc.id} onClick={() => setPreviewing(doc)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-left"><span className="min-w-0"><span className="block truncate text-sm font-medium">{doc.name}</span><span className="block truncate text-xs text-slate-500">{doc.fileName || 'Not uploaded'}</span></span><DocStatusBadge status={doc.status} /></button>)}</div>}
                </div>;
              })}
            </MobileCardList>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={grouped.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>

      <DocumentPreviewModal
        document={previewing}
        onClose={() => setPreviewing(null)}
        role="admin"
        customerName={
          previewing ? appMap.get(previewing.applicationId)?.customer.fullName : undefined
        }
      />
    </>
  );
}
