import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellOff,
  CheckCheck,
  CircleCheckBig,
  FileWarning,
  RefreshCw,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { ConfirmDialog } from '@/components/ui/Modal';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { cn, formatDateTime, relativeTime } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import type { NotificationKind } from '@/types';

const KIND_META: Record<
  NotificationKind,
  { icon: typeof Bell; tone: string; label: string }
> = {
  document: { icon: FileWarning, tone: 'bg-amber-50 text-amber-600', label: 'Documents' },
  status: { icon: RefreshCw, tone: 'bg-brand-50 text-brand-600', label: 'Status' },
  payout: { icon: Wallet, tone: 'bg-money-50 text-money-600', label: 'Payout' },
  approval: { icon: CircleCheckBig, tone: 'bg-money-50 text-money-600', label: 'Approval' },
  alert: { icon: TriangleAlert, tone: 'bg-rose-50 text-rose-600', label: 'Alert' },
};

export function Notifications() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { notifications, markNotificationRead, markAllNotificationsRead, clearNotifications } =
    useData();

  const [tab, setTab] = useState('all');
  const [clearOpen, setClearOpen] = useState(false);

  const role = user!.role;
  const base = role === 'admin' ? '/admin' : '/app';

  const mine = useMemo(
    () =>
      notifications
        .filter((n) => n.audience === role)
        .sort((a, b) => +new Date(b.at) - +new Date(a.at)),
    [notifications, role],
  );

  const unread = mine.filter((n) => !n.read);

  const filtered = useMemo(() => {
    if (tab === 'unread') return unread;
    if (tab === 'all') return mine;
    return mine.filter((n) => n.kind === tab);
  }, [tab, mine, unread]);

  const tabs = [
    { id: 'all', label: 'All', count: mine.length },
    { id: 'unread', label: 'Unread', count: unread.length },
    { id: 'document', label: 'Documents', count: mine.filter((n) => n.kind === 'document').length },
    { id: 'status', label: 'Status', count: mine.filter((n) => n.kind === 'status').length },
    { id: 'payout', label: 'Payouts', count: mine.filter((n) => n.kind === 'payout').length },
  ];

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          unread.length
            ? `${unread.length} unread update${unread.length === 1 ? '' : 's'} from the processing desk.`
            : 'You are up to date with everything from the processing desk.'
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={<CheckCheck className="size-4" />}
              disabled={unread.length === 0}
              onClick={() => {
                markAllNotificationsRead(role);
                toast.success('All caught up', 'Every notification is marked as read.');
              }}
            >
              Mark all read
            </Button>
            <Button
              variant="ghost"
              icon={<BellOff className="size-4" />}
              disabled={mine.length === 0}
              onClick={() => setClearOpen(true)}
            >
              Clear all
            </Button>
          </>
        }
      />

      <Card>
        <div className="px-4 pt-1 sm:px-5">
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-5" />}
            title="Nothing here"
            description="New updates on your applications, documents and payouts will show up here."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((n) => {
              const meta = KIND_META[n.kind];
              const Icon = meta.icon;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markNotificationRead(n.id);
                      if (n.applicationId) navigate(`${base}/applications/${n.applicationId}`);
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 sm:px-5',
                      !n.read && 'bg-brand-50/30',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                        meta.tone,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span
                          className={cn(
                            'text-[14px] text-slate-900',
                            n.read ? 'font-medium' : 'font-semibold',
                          )}
                        >
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                            New
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-slate-600">
                        {n.body}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                        <span>{relativeTime(n.at)}</span>
                        <span>·</span>
                        <span>{formatDateTime(n.at)}</span>
                        {n.applicationId && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-brand-600">{n.applicationId}</span>
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={clearOpen}
        title="Clear all notifications?"
        message="This removes every notification from your inbox. It cannot be undone in this prototype."
        confirmLabel="Clear all"
        tone="danger"
        onConfirm={() => {
          clearNotifications(role);
          setClearOpen(false);
          toast.success('Notifications cleared');
        }}
        onCancel={() => setClearOpen(false)}
      />
    </>
  );
}
