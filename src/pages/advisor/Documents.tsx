import { Fragment, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Eye, FileSearch, FileText, UploadCloud, XCircle } from 'lucide-react';
import { DocumentPreviewModal } from '@/components/crm/DocumentPreviewModal';
import { FilterBar } from '@/components/crm/FilterBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { FileTypeIcon, validateFile } from '@/components/ui/FileUpload';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { Pagination } from '@/components/ui/Pagination';
import { StatCard } from '@/components/ui/StatCard';
import { DocStatusBadge } from '@/components/ui/StatusBadge';
import { MobileCardList, TBody, TD, TH, THead, TR, TableWrap } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { DOCUMENT_STATUSES } from '@/lib/constants';
import { formatBytes, formatDate, matchesQuery } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import type { AppDocument } from '@/types';

const TABS = [
  { id: 'action', label: 'Needs your action' },
  { id: 'all', label: 'All documents' },
  { id: 'verifying', label: 'Under verification' },
  { id: 'verified', label: 'Verified' },
];

export function Documents() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { applications, documents, replaceDocument, loading } = useData();
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState('action');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [target, setTarget] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<AppDocument | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const appMap = useMemo(() => new Map(applications.map((app) => [app.id, app])), [applications]);
  const mine = useMemo(() => documents.filter((doc) => appMap.get(doc.applicationId)?.advisorId === user?.id), [documents, appMap, user]);

  const counts = useMemo(() => ({
    action: mine.filter((doc) => ['Pending', 'Re-upload Required', 'Rejected'].includes(doc.status)).length,
    all: mine.length,
    verifying: mine.filter((doc) => ['Uploaded', 'Under Verification'].includes(doc.status)).length,
    verified: mine.filter((doc) => doc.status === 'Verified').length,
  }), [mine]);

  const filtered = useMemo(() => mine
    .filter((doc) => {
      if (tab === 'action') return ['Pending', 'Re-upload Required', 'Rejected'].includes(doc.status);
      if (tab === 'verifying') return ['Uploaded', 'Under Verification'].includes(doc.status);
      if (tab === 'verified') return doc.status === 'Verified';
      return true;
    })
    .filter((doc) => matchesQuery(query, doc.applicationId, doc.name, doc.fileName, appMap.get(doc.applicationId)?.customer.fullName))
    .filter((doc) => status ? doc.status === status : true)
    .sort((a, b) => +new Date(b.uploadedAt ?? 0) - +new Date(a.uploadedAt ?? 0)), [mine, tab, query, status, appMap]);

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

  const chooseFile = (documentId: string) => {
    setTarget(documentId);
    fileInput.current?.click();
  };

  const onFilePicked = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !target) return;
    const problem = validateFile(file);
    if (problem) { toast.error('File rejected', problem); return; }
    try {
      await replaceDocument(target, { fileName: file.name, fileType: file.type || 'application/octet-stream', size: file.size, file });
      setTarget(null);
      toast.success('Document uploaded', 'It has been sent to the verification desk.');
    } catch (error) {
      toast.error('Upload failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return <>
    <PageHeader
      title="Documents"
      description="Your applications are grouped by lead. Open a lead to view, upload, or replace its documents."
      actions={<Button variant="secondary" icon={<ClipboardCheck className="size-4 text-brand-600" />} onClick={() => navigate('/app/documentation-required')}>Required Documents Checklist</Button>}
    />

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Needs your action" value={counts.action} icon={<UploadCloud className="size-4" />} tone="warn" onClick={() => setTab('action')} />
      <StatCard label="Total documents" value={counts.all} icon={<FileText className="size-4" />} tone="brand" onClick={() => setTab('all')} />
      <StatCard label="Under verification" value={counts.verifying} icon={<FileSearch className="size-4" />} tone="info" onClick={() => setTab('verifying')} />
      <StatCard label="Verified" value={counts.verified} icon={<CheckCircle2 className="size-4" />} tone="money" onClick={() => setTab('verified')} />
    </div>

    <Card className="mt-3">
      <div className="px-4 pt-1 sm:px-5"><Tabs tabs={TABS.map((item) => ({ ...item, count: counts[item.id as keyof typeof counts] }))} active={tab} onChange={(id) => { setTab(id); setPage(1); setExpandedId(null); }} /></div>
      <FilterBar
        query={query}
        onQueryChange={(value) => { setQuery(value); setPage(1); }}
        placeholder="Search by application, customer or document…"
        selects={[{ id: 'status', label: 'All statuses', value: status, options: DOCUMENT_STATUSES, onChange: (value) => { setStatus(value); setPage(1); } }]}
        onReset={() => { setStatus(''); setPage(1); }}
        activeCount={status ? 1 : 0}
      />

      {loading ? <TableSkeleton rows={8} cols={6} /> : grouped.length === 0 ? (
        <EmptyState icon={<FileSearch className="size-5" />} title="No applications in this view" description="Applications appear here with all their documents grouped together." />
      ) : <>
        <div className="hidden lg:block">
          <TableWrap className="min-w-full">
            <THead><TH>Lead / Application</TH><TH>Service</TH><TH align="right">Documents</TH><TH>Progress</TH><TH>Status</TH><TH align="right">Open</TH></THead>
            <TBody>{paged.map((group) => {
              const app = group.application;
              const open = expandedId === group.applicationId;
              const verified = group.documents.filter((doc) => doc.status === 'Verified').length;
              const needsAction = group.documents.filter((doc) => ['Pending', 'Re-upload Required', 'Rejected'].includes(doc.status)).length;
              return <Fragment key={group.applicationId}>
                <TR onClick={() => setExpandedId(open ? null : group.applicationId)}>
                  <TD><span className="flex items-center gap-2.5">{open ? <ChevronDown className="size-4 text-brand-600" /> : <ChevronRight className="size-4 text-slate-400" />}<span><span className="block font-semibold text-slate-900">{app?.customer.fullName ?? 'Unknown lead'}</span><span className="block text-xs text-brand-700">{group.applicationId}</span></span></span></TD>
                  <TD>{app?.service ?? '—'}</TD>
                  <TD align="right" className="tnum font-medium">{group.documents.length}</TD>
                  <TD><span className="text-sm text-slate-600">{verified} verified · {group.documents.length - verified} pending</span></TD>
                  <TD>{needsAction > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"><XCircle className="size-3.5" />{needsAction} need action</span> : <span className="text-xs text-slate-500">Up to date</span>}</TD>
                  <TD align="right"><Button variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); setExpandedId(open ? null : group.applicationId); }}>{open ? 'Close' : 'View documents'}</Button></TD>
                </TR>
                {open && <TR className="bg-slate-50/70"><TD colSpan={6} className="p-0">
                  <div className="divide-y divide-slate-200 border-y border-slate-200">{group.documents.map((doc) => <div key={doc.id} className="grid grid-cols-[minmax(220px,1fr)_150px_140px_auto] items-center gap-4 px-8 py-3">
                    <span className="flex min-w-0 items-center gap-2"><FileTypeIcon fileType={doc.fileType} /><span className="min-w-0"><span className="block font-medium text-slate-800">{doc.name}</span><span className="block truncate text-xs text-slate-500">{doc.fileName ? `${doc.fileName} · ${formatBytes(doc.size)}` : 'Not uploaded'}</span></span></span>
                    <span className="text-xs text-slate-500">{formatDate(doc.uploadedAt)}</span>
                    <DocStatusBadge status={doc.status} />
                    <span className="flex justify-end gap-1.5"><Button variant="ghost" size="sm" icon={<Eye className="size-3.5" />} disabled={!doc.fileName} onClick={() => setPreviewing(doc)}>Preview</Button><Button variant="secondary" size="sm" onClick={() => chooseFile(doc.id)}>{doc.fileName ? 'Replace' : 'Upload'}</Button></span>
                  </div>)}</div>
                </TD></TR>}
              </Fragment>;
            })}</TBody>
          </TableWrap>
        </div>

        <MobileCardList className="lg:hidden">{paged.map((group) => {
          const open = expandedId === group.applicationId;
          return <div key={group.applicationId} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setExpandedId(open ? null : group.applicationId)}><span><span className="block font-semibold text-slate-900">{group.application?.customer.fullName ?? 'Unknown lead'}</span><span className="mt-0.5 block text-xs text-brand-700">{group.applicationId}</span><span className="mt-1 block text-xs text-slate-500">{group.documents.length} documents · {group.application?.service ?? '—'}</span></span>{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</button>
            {open && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">{group.documents.map((doc) => <div key={doc.id} className="rounded-xl bg-slate-50 p-3"><button type="button" disabled={!doc.fileName} onClick={() => setPreviewing(doc)} className="flex w-full items-center justify-between gap-2 text-left"><span className="min-w-0"><span className="block truncate text-sm font-medium">{doc.name}</span><span className="block truncate text-xs text-slate-500">{doc.fileName || 'Not uploaded'}</span></span><DocStatusBadge status={doc.status} /></button><Button className="mt-2" variant="secondary" size="sm" onClick={() => chooseFile(doc.id)}>{doc.fileName ? 'Replace' : 'Upload'}</Button></div>)}</div>}
          </div>;
        })}</MobileCardList>
        <Pagination page={page} pageSize={pageSize} total={grouped.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </>}
    </Card>

    <DocumentPreviewModal document={previewing} onClose={() => setPreviewing(null)} role="advisor" customerName={previewing ? appMap.get(previewing.applicationId)?.customer.fullName : undefined} />
    <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(event) => { void onFilePicked(event.target.files); event.target.value = ''; }} />
  </>;
}
