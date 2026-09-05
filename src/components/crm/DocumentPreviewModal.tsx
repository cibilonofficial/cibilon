import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileText, ImageIcon, RotateCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DetailItem } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Field';
import { validateFile } from '@/components/ui/FileUpload';
import { Modal } from '@/components/ui/Modal';
import { DocStatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { formatBytes, formatDateTime } from '@/lib/utils';
import { apiDownload, errorMessage } from '@/lib/api';
import { useData } from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import type { AppDocument, Role } from '@/types';

interface DocumentPreviewModalProps {
  document: AppDocument | null;
  onClose: () => void;
  role: Role;
  /** Customer name shown in the header, when the caller knows it. */
  customerName?: string;
}

/** Shared document metadata, download, verification, rejection and re-upload dialog. */
export function DocumentPreviewModal({
  document: doc,
  onClose,
  role,
  customerName,
}: DocumentPreviewModalProps) {
  const toast = useToast();
  const { user } = useAuth();
  const { setDocumentStatus, replaceDocument } = useData();
  const fileInput = useRef<HTMLInputElement>(null);
  const [remarks, setRemarks] = useState('');
  const [mode, setMode] = useState<'view' | 'reject' | 'reupload'>('view');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRemarks('');
    setMode('view');
  }, [doc?.id]);

  if (!doc) return null;

  const isImage = doc.fileType.startsWith('image/');
  const isAdmin = role === 'admin' || (role === 'staff' && Boolean(user?.permissions.includes('documents:verify')));

  const verify = async () => {
    setSaving(true);
    try {
      await setDocumentStatus(doc.id, 'Verified', '');
      toast.success('Document verified', doc.name);
      onClose();
    } catch (error) { toast.error('Verification failed', errorMessage(error)); }
    finally { setSaving(false); }
  };

  const commit = async (status: 'Rejected' | 'Re-upload Required') => {
    const fallback =
      status === 'Rejected'
        ? 'Document does not match the applicant details on record.'
        : 'Please upload a clearer copy of this document.';
    setSaving(true);
    try {
    await setDocumentStatus(doc.id, status, remarks || fallback);
    toast.warning(
      status === 'Rejected' ? 'Document rejected' : 'Re-upload requested',
      `The advisor has been notified about ${doc.name}.`,
    );
    onClose();
    } catch (error) { toast.error('Document update failed', errorMessage(error)); }
    finally { setSaving(false); }
  };

  const onFilePicked = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const problem = validateFile(file);
    if (problem) {
      toast.error('File rejected', problem);
      return;
    }
    replaceDocument(doc.id, {
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      size: file.size,
      file,
    });
    toast.success('Document uploaded', 'It has been sent to the verification desk.');
    onClose();
  };

  const openOriginal = async () => {
    try {
      const { blob, fileName } = await apiDownload(`/documents/${doc.id}/download`);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url; anchor.download = fileName; anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      toast.error('Download failed', errorMessage(requestError));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={doc.name}
      description={`${doc.applicationId}${customerName ? ` · ${customerName}` : ''}`}
      footer={
        isAdmin ? (
          mode === 'view' ? (
            <>
              <Button variant="secondary" onClick={() => setMode('reject')} disabled={!doc.fileName}>
                Reject
              </Button>
              <Button
                variant="secondary"
                icon={<RotateCw className="size-3.5" />}
                onClick={() => setMode('reupload')}
              >
                Request re-upload
              </Button>
              <Button
                variant="success"
                icon={<CheckCircle2 className="size-4" />}
                disabled={!doc.fileName || doc.status === 'Verified'}
                loading={saving}
                onClick={verify}
              >
                Verify
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setMode('view')}>
                Back
              </Button>
              <Button
                variant={mode === 'reject' ? 'danger' : 'primary'}
                loading={saving}
                onClick={() => commit(mode === 'reject' ? 'Rejected' : 'Re-upload Required')}
              >
                {mode === 'reject' ? 'Reject document' : 'Send back to advisor'}
              </Button>
            </>
          )
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {role === 'advisor' && <Button onClick={() => fileInput.current?.click()}>
              {doc.fileName ? 'Replace file' : 'Upload file'}
            </Button>}
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
          {doc.fileName ? (
            <>
              {isImage ? (
                <ImageIcon className="size-9 text-sky-600" />
              ) : (
                <FileText className="size-9 text-rose-600" />
              )}
              <p className="text-sm font-medium text-slate-800">{doc.fileName}</p>
              <p className="text-xs text-slate-500">
                {formatBytes(doc.size)} · {isImage ? 'Image' : 'PDF document'}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                icon={<Download className="size-3.5" />}
                onClick={() => void openOriginal()}
              >
                Open original
              </Button>
            </>
          ) : (
            <>
              <XCircle className="size-9 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">Nothing uploaded yet</p>
              <p className="text-xs text-slate-500">
                This slot is still waiting on the advisor.
              </p>
            </>
          )}
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailItem label="Verification status" value={<DocStatusBadge status={doc.status} />} />
          <DetailItem label="Requirement" value={doc.required ? 'Mandatory' : 'Optional'} />
          <DetailItem label="Uploaded" value={formatDateTime(doc.uploadedAt)} />
          <DetailItem label="Application" value={doc.applicationId} mono />
          {doc.remarks && (
            <DetailItem label="Desk remarks" value={doc.remarks} className="sm:col-span-2" />
          )}
        </dl>

        {isAdmin && mode !== 'view' && (
          <Textarea
            label={
              mode === 'reject'
                ? 'Why is this document being rejected?'
                : 'What should the advisor re-upload?'
            }
            rows={3}
            placeholder={
              mode === 'reject'
                ? 'Document does not match the applicant details on record.'
                : 'Scan is not legible. Please upload a clearer colour copy.'
            }
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        )}
      </div>

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
    </Modal>
  );
}
