import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (tone: ToastTone, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { icon: ReactNode; ring: string; bar: string }> = {
  success: {
    icon: <CheckCircle2 className="size-4 text-money-600" />,
    ring: 'ring-money-500/20',
    bar: 'bg-money-500',
  },
  error: {
    icon: <AlertCircle className="size-4 text-rose-600" />,
    ring: 'ring-rose-500/20',
    bar: 'bg-rose-500',
  },
  info: {
    icon: <Info className="size-4 text-brand-600" />,
    ring: 'ring-brand-500/20',
    bar: 'bg-brand-500',
  },
  warning: {
    icon: <TriangleAlert className="size-4 text-amber-600" />,
    ring: 'ring-amber-500/20',
    bar: 'bg-amber-500',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, tone, title, description }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast('success', title, description),
      error: (title, description) => toast('error', title, description),
      info: (title, description) => toast('info', title, description),
      warning: (title, description) => toast('warning', title, description),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:top-0 sm:items-end">
          {toasts.map((t) => {
            const style = TONE_STYLES[t.tone];
            return (
              <div
                key={t.id}
                role="status"
                className={cn(
                  'pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-lg bg-white p-3.5 pl-5 shadow-raised ring-1 animate-slide-up',
                  style.ring,
                )}
              >
                <span className={cn('absolute left-0 top-0 h-full w-1', style.bar)} />
                <span className="mt-0.5 shrink-0">{style.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{t.title}</p>
                  {t.description && (
                    <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{t.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Dismiss notification"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
