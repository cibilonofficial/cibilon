import { useCallback, useRef, useState, type DragEvent } from 'react';
import { FileText, ImageIcon, Paperclip, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { cn, formatBytes } from '@/lib/utils';
import { Button } from './Button';
import { DocStatusBadge } from './StatusBadge';
import type { DocumentStatus } from '@/types';

export interface UploadedFile {
  id: string;
  /** Checklist slot this file satisfies, e.g. "PAN Card". */
  name: string;
  fileName: string;
  fileType: string;
  size: number;
  /** 0–100. Selected files are sent to the API when the form is submitted. */
  progress: number;
  status: DocumentStatus;
  required: boolean;
  /** Browser file retained until it is sent as multipart data to the API. */
  file?: File;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png';
const MAX_BYTES = 10 * 1024 * 1024;

export function FileTypeIcon({ fileType, className }: { fileType: string; className?: string }) {
  if (fileType.startsWith('image/'))
    return <ImageIcon className={cn('size-4 text-sky-600', className)} />;
  if (fileType === 'application/pdf')
    return <FileText className={cn('size-4 text-rose-600', className)} />;
  return <Paperclip className={cn('size-4 text-slate-500', className)} />;
}

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
  hint?: string;
  compact?: boolean;
  disabled?: boolean;
}

export function Dropzone({
  onFiles,
  multiple = true,
  label = 'Drag and drop documents here',
  hint = 'PDF, JPG or PNG · up to 10 MB per file',
  compact = false,
  disabled = false,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFiles(multiple ? files : files.slice(0, 1));
    },
    [disabled, multiple, onFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition-all',
        compact ? 'gap-1 px-4 py-5' : 'gap-2 px-6 py-10',
        dragging
          ? 'border-brand-500 bg-brand-50/70'
          : 'border-slate-300 bg-slate-50/60 hover:border-brand-400 hover:bg-brand-50/40',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <UploadCloud
        className={cn(compact ? 'size-5' : 'size-7', dragging ? 'text-brand-600' : 'text-slate-400')}
      />
      <p className={cn('font-medium text-slate-700', compact ? 'text-[13px]' : 'text-sm')}>
        {label}
      </p>
      <p className="text-xs text-slate-500">
        or <span className="font-medium text-brand-700">browse files</span> · {hint}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

interface UploadRowProps {
  file: UploadedFile;
  onRemove?: () => void;
  onReplace?: () => void;
}

export function UploadRow({ file, onRemove, onReplace }: UploadRowProps) {
  const uploading = file.progress < 100;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
        <FileTypeIcon fileType={file.fileType} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-[13px] font-medium text-slate-800">{file.name}</p>
          {file.required && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Required
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {file.fileName} · {formatBytes(file.size)}
        </p>
        {uploading && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-200"
              style={{ width: `${file.progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {uploading ? (
          <span className="tnum text-xs font-medium text-slate-500">{file.progress}%</span>
        ) : (
          <DocStatusBadge status={file.status} className="hidden sm:inline-flex" />
        )}
        {onReplace && !uploading && (
          <Button variant="ghost" size="icon" onClick={onReplace} aria-label="Replace file">
            <RefreshCw className="size-3.5" />
          </Button>
        )}
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Remove file"
            className="text-slate-400 hover:text-rose-600"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function validateFile(file: File): string | null {
  const ok = /\.(pdf|jpe?g|png)$/i.test(file.name);
  if (!ok) return `${file.name}: only PDF, JPG or PNG files are accepted.`;
  if (file.size > MAX_BYTES) return `${file.name}: file is larger than 10 MB.`;
  return null;
}
