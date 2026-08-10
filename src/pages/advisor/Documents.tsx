import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, FileText, UploadCloud } from 'lucide-react';
import { DocumentPreviewModal } from '@/components/crm/DocumentPreviewModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { FileTypeIcon, validateFile } from '@/components/ui/FileUpload';
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
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import type { AppDocument } from '@/types';

const TABS = [
  { id: 'all', label: 'All documents' },
  { id: 'action', label: 'Needs re-upload' },
  { id: 'verifying', label: 'Under verification' },
  { id: 'verified', label: 'Verified' },
];

export function Documents() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { applications, documents, replaceDocument } = useData();
  const loading = useMockLoading();
  const fileInput = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [target, setTarget] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<AppDocument | null>(null);

  const appMap = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications]);

  const mine = useMemo(
    () =>
      documents
        .filter((doc) => appMap.get(doc.applicationId)?.advisorId === user!.id)
        .sort((a, b) => +new Date(b.uploadedAt ?? 0) - +new Date(a.uploadedAt ?? 0)),
    [documents, appMap, user],
  );

  const counts = useMemo(
    () => ({
      all: mine.length,
      action: mine.filter((d) =>
        ['Pending', 'Re-upload Required', 'Rejected'].includes(d.status),
      ).length,
      verifying: mine.filter((d) =>
        ['Uploaded', 'Under Verification'].includes(d.status),
      ).length,
      verified: mine.filter((d) => d.status === 'Verified').length,
    }),
    [mine],
  );

  const filtered = useMemo(
    () =>
      mine
        .filter((doc) => {
          if (tab === 'action')
            return ['Pending', 'Re-upload Required', 'Rejected'].includes(doc.status);
          if (tab === 'verifying') return ['Uploaded', 'Under Verification'].includes(doc.status);
          if (tab === 'verified') return doc.status === 'Verified';
          return true;
        })
        .filter((doc) =>
          matchesQuery(
            query,
            doc.applicationId,
            doc.name,
            doc.fileName,
            appMap.get(doc.applicationId)?.customer.fullName,
          ),
        )
        .filter((doc) => (status ? doc.status === status : true)),
    [mine, tab, query, status, appMap],
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const onFilePicked = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !target) return;
    const problem = validateFile(file);
    if (problem) {
      toast.error('File rejected', problem);
      return;
    }
    replaceDocument(target, {
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      size: file.size,
    });
    setTarget(null);
    toast.success('Document uploaded', 'It has been sent to the verification desk.');
  };

  return (
    <>
      <PageHeader
        title="Documents"
        description="Every document across your applications, and what the verification desk needs from you."
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total documents"
          value={counts.all}
          icon={<FileText className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Needs your action"
          value={counts.action}
          icon={<UploadCloud className="size-4" />}
          tone="warn"
          onClick={() => setTab('action')}
        />
        <StatCard
          label="Under verification"
          value={counts.verifying}
          icon={<FileText className="size-4" />}
          tone="info"
          onClick={() => setTab('verifying')}
        />
        <StatCard
          label="Verified"
          value={counts.verified}
          icon={<FileText className="size-4" />}
          tone="money"
          onClick={() => setTab('verified')}
        />
      </div>

      <Card>
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
          placeholder="Search by application, customer or document…"
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
          <TableSkeleton rows={8} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="No documents in this view"
            description="Documents appear here as soon as you attach them to an application."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Application</TH>
                  <TH>Customer</TH>
                  <TH>Document</TH>
                  <TH>Uploaded</TH>
                  <TH>Verification status</TH>
                  <TH>Remarks</TH>
                  <TH align="right">Action</TH>
                </THead>
                <TBody>
                  {paged.map((doc) => {
                    const app = appMap.get(doc.applicationId);
                    return (
                      <TR key={doc.id}>
                        <TD>
                          <button
                            type="button"
                            onClick={() => navigate(`/app/applications/${doc.applicationId}`)}
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {doc.applicationId}
                          </button>
                        </TD>
                        <TD>{app?.customer.fullName ?? '—'}</TD>
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
                        </TD>
                        <TD className="max-w-[16rem]">
                          <span className="line-clamp-2 text-xs text-slate-500">
                            {doc.remarks || '—'}
                          </span>
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
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setTarget(doc.id);
                                fileInput.current?.click();
                              }}
                            >
                              {doc.fileName ? 'Replace' : 'Upload'}
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
                    { label: 'File', value: doc.fileName || 'Not uploaded' },
                    { label: 'Uploaded', value: formatDate(doc.uploadedAt) },
                  ]}
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setTarget(doc.id);
                        fileInput.current?.click();
                      }}
                    >
                      {doc.fileName ? 'Replace' : 'Upload'}
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

      <DocumentPreviewModal
        document={previewing}
        onClose={() => setPreviewing(null)}
        role="advisor"
        customerName={
          previewing ? appMap.get(previewing.applicationId)?.customer.fullName : undefined
        }
      />

      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          onFilePicked(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}
