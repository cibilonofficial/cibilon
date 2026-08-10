import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, FileSearch, FileText, XCircle } from 'lucide-react';
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
import { DOCUMENT_STATUSES } from '@/lib/constants';
import { formatBytes, formatDate, matchesQuery } from '@/lib/utils';
import { useMockLoading } from '@/hooks/useMockLoading';
import { useData } from '@/store/DataContext';
import type { AppDocument } from '@/types';

const TABS = [
  { id: 'queue', label: 'Verification queue' },
  { id: 'all', label: 'All documents' },
  { id: 'Verified', label: 'Verified' },
  { id: 'Rejected', label: 'Rejected' },
];

export function AdminDocuments() {
  const navigate = useNavigate();
  const toast = useToast();
  const { documents, applications, setDocumentStatus } = useData();
  const loading = useMockLoading();

  const [tab, setTab] = useState('queue');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [previewing, setPreviewing] = useState<AppDocument | null>(null);

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

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const verify = (doc: AppDocument) => {
    setDocumentStatus(doc.id, 'Verified', '');
    toast.success('Document verified', `${doc.name} on ${doc.applicationId}`);
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
        ) : filtered.length === 0 ? (
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
                  <TH>Application</TH>
                  <TH>Customer</TH>
                  <TH>Advisor</TH>
                  <TH>Document</TH>
                  <TH>Uploaded</TH>
                  <TH>Status</TH>
                  <TH align="right">Verification</TH>
                </THead>
                <TBody>
                  {paged.map((doc) => {
                    const app = appMap.get(doc.applicationId);
                    return (
                      <TR key={doc.id}>
                        <TD>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/applications/${doc.applicationId}`)}
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {doc.applicationId}
                          </button>
                        </TD>
                        <TD>{app?.customer.fullName ?? '—'}</TD>
                        <TD className="text-slate-600">{app?.advisorName ?? '—'}</TD>
                        <TD>
                          <span className="flex items-center gap-2">
                            <FileTypeIcon fileType={doc.fileType} />
                            <span className="min-w-0">
                              <span className="block font-medium text-slate-800">{doc.name}</span>
                              <span className="block truncate text-xs text-slate-500">
                                {doc.fileName
                                  ? `${doc.fileName} · ${formatBytes(doc.size)}`
                                  : 'Not uploaded'}
                              </span>
                            </span>
                          </span>
                        </TD>
                        <TD className="whitespace-nowrap">{formatDate(doc.uploadedAt)}</TD>
                        <TD>
                          <DocStatusBadge status={doc.status} />
                          {doc.remarks && (
                            <span className="mt-0.5 line-clamp-1 block text-xs text-slate-400">
                              {doc.remarks}
                            </span>
                          )}
                        </TD>
                        <TD align="right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Eye className="size-3.5" />}
                              onClick={() => setPreviewing(doc)}
                            >
                              Preview
                            </Button>
                            <Button
                              variant="success"
                              size="sm"
                              disabled={!doc.fileName || doc.status === 'Verified'}
                              onClick={() => verify(doc)}
                            >
                              Verify
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!doc.fileName}
                              onClick={() => setPreviewing(doc)}
                            >
                              Bounce
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
              {paged.map((doc) => (
                <MobileRow
                  key={doc.id}
                  title={doc.name}
                  subtitle={`${doc.applicationId} · ${appMap.get(doc.applicationId)?.customer.fullName ?? ''}`}
                  badge={<DocStatusBadge status={doc.status} />}
                  rows={[
                    { label: 'Advisor', value: appMap.get(doc.applicationId)?.advisorName ?? '—' },
                    { label: 'Uploaded', value: formatDate(doc.uploadedAt) },
                  ]}
                  action={
                    <>
                      <Button variant="secondary" size="sm" onClick={() => setPreviewing(doc)}>
                        Preview
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        disabled={!doc.fileName || doc.status === 'Verified'}
                        onClick={() => verify(doc)}
                      >
                        Verify
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
