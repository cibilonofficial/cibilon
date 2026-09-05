import { useMemo, useState } from 'react';
import {
  BookOpen,
  LifeBuoy,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Send,
} from 'lucide-react';
import { FilterBar } from '@/components/crm/FilterBar';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, PageHeader, SectionTitle, Tabs } from '@/components/ui/Misc';
import { StatCard } from '@/components/ui/StatCard';
import { PriorityBadge, TicketBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '@/lib/constants';
import { cn, formatDateTime, matchesQuery, relativeTime } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import type { SupportTicket, TicketCategory, TicketPriority } from '@/types';

const FAQS = [
  {
    q: 'How long does document verification take?',
    a: 'The verification desk clears documents within one working day. Anything bounced back shows up on your Documents page with the reason attached.',
  },
  {
    q: 'When are payouts released?',
    a: 'Payouts are raised automatically on disbursal and released in the fortnightly run. You can track each one on the Payouts page.',
  },
  {
    q: 'Can I edit a submitted application?',
    a: 'Customer and service details can be corrected while the file is in Submitted or Documents Required. After that, raise a ticket and the ops team will amend it.',
  },
  {
    q: 'What happens if a lender rejects a file?',
    a: 'The rejection reason is recorded on the application timeline. You can re-submit to another lender by raising a fresh lead with the same customer.',
  },
];

const EMPTY = {
  subject: '',
  category: '' as TicketCategory | '',
  priority: 'Normal' as TicketPriority,
  applicationId: '',
  body: '',
};

export function Support() {
  const toast = useToast();
  const { user } = useAuth();
  const { tickets, applications, createTicket, replyToTicket, setTicketStatus } = useData();

  const [tab, setTab] = useState('open');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [active, setActive] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState('');

  const mine = useMemo(
    () =>
      tickets
        .filter((t) => t.advisorId === user!.id)
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
    [tickets, user],
  );

  const myApplications = useMemo(
    () => applications.filter((a) => a.advisorId === user!.id),
    [applications, user],
  );

  const counts = {
    all: mine.length,
    open: mine.filter((t) => t.status === 'Open' || t.status === 'In Progress').length,
    resolved: mine.filter((t) => t.status === 'Resolved').length,
    closed: mine.filter((t) => t.status === 'Closed').length,
  };

  const filtered = mine
    .filter((t) =>
      tab === 'all'
        ? true
        : tab === 'open'
          ? t.status === 'Open' || t.status === 'In Progress'
          : tab === 'resolved'
            ? t.status === 'Resolved'
            : t.status === 'Closed',
    )
    .filter((t) => matchesQuery(query, t.id, t.subject, t.category, t.applicationId));

  // Keep the open thread in sync with new replies.
  const current = active ? (mine.find((t) => t.id === active.id) ?? active) : null;

  const submit = async () => {
    if (!form.subject.trim() || !form.category || !form.body.trim()) return;
    const ticket = await createTicket({
      advisorId: user!.id,
      advisorName: user!.name,
      subject: form.subject.trim(),
      category: form.category,
      priority: form.priority,
      applicationId: form.applicationId || null,
      body: form.body.trim(),
    });
    setForm(EMPTY);
    setFormOpen(false);
    setActive(ticket);
    toast.success('Ticket raised', `${ticket.id} is with the support desk.`);
  };

  const sendReply = async () => {
    if (!current || !reply.trim()) return;
    await replyToTicket(current.id, reply.trim(), user!.name, 'advisor');
    setReply('');
    toast.success('Reply sent', `Added to ${current.id}.`);
  };

  return (
    <>
      <PageHeader
        title="Support"
        description="Raise a query with the Cibilon operations desk and track every conversation in one place."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>
            New ticket
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="All tickets" value={counts.all} icon={<LifeBuoy className="size-4" />} tone="brand" />
        <StatCard
          label="Open"
          value={counts.open}
          icon={<MessageSquare className="size-4" />}
          tone="warn"
          onClick={() => setTab('open')}
        />
        <StatCard
          label="Resolved"
          value={counts.resolved}
          icon={<MessageSquare className="size-4" />}
          tone="money"
          onClick={() => setTab('resolved')}
        />
        <StatCard
          label="Closed"
          value={counts.closed}
          icon={<MessageSquare className="size-4" />}
          tone="neutral"
          onClick={() => setTab('closed')}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="px-4 pt-1 sm:px-5">
            <Tabs
              tabs={[
                { id: 'open', label: 'Open', count: counts.open },
                { id: 'resolved', label: 'Resolved', count: counts.resolved },
                { id: 'closed', label: 'Closed', count: counts.closed },
                { id: 'all', label: 'All', count: counts.all },
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>

          <FilterBar
            query={query}
            onQueryChange={setQuery}
            placeholder="Search your tickets…"
          />

          {filtered.length === 0 ? (
            <EmptyState
              icon={<LifeBuoy className="size-5" />}
              title="No tickets here"
              description="Raise a ticket and the operations desk will pick it up within one working day."
              action={
                <Button icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>
                  New ticket
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => setActive(ticket)}
                    className="flex w-full flex-wrap items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-900">
                        {ticket.subject}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {ticket.id} · {ticket.category}
                        {ticket.applicationId ? ` · ${ticket.applicationId}` : ''}
                      </span>
                      <span className="mt-1 line-clamp-1 block text-[13px] text-slate-600">
                        {ticket.messages[ticket.messages.length - 1]?.body}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <TicketBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                      <span className="text-[11px] text-slate-400">
                        {relativeTime(ticket.updatedAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader title="Talk to us" subtitle="Monday to Saturday, 9:30am – 6:30pm IST" />
            <CardBody className="space-y-3 text-[13px]">
              <a
                href="tel:+912266001200"
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <Phone className="size-4 text-slate-400" />
                +91 22 6600 1200
              </a>
              <a
                href="mailto:partners@cibilon.in"
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <Mail className="size-4 text-slate-400" />
                partners@cibilon.in
              </a>
              <p className="text-xs leading-relaxed text-slate-500">
                For anything file-specific, raise a ticket and tag the application — it reaches the
                desk already handling that case.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Common questions" />
            <CardBody className="space-y-4">
              {FAQS.map((faq) => (
                <div key={faq.q}>
                  <p className="flex items-start gap-2 text-[13px] font-medium text-slate-800">
                    <BookOpen className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                    {faq.q}
                  </p>
                  <p className="mt-1 pl-5 text-[13px] leading-relaxed text-slate-600">{faq.a}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Thread */}
      <Modal
        open={Boolean(current)}
        onClose={() => setActive(null)}
        size="lg"
        title={current?.subject ?? ''}
        description={
          current
            ? `${current.id} · ${current.category}${current.applicationId ? ` · ${current.applicationId}` : ''}`
            : undefined
        }
        footer={
          current && (
            <>
              {current.status !== 'Closed' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTicketStatus(current.id, 'Closed');
                    toast.success('Ticket closed', `${current.id} has been closed.`);
                  }}
                >
                  Close ticket
                </Button>
              )}
              <Button icon={<Send className="size-4" />} disabled={!reply.trim()} onClick={sendReply}>
                Send reply
              </Button>
            </>
          )
        }
      >
        {current && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <TicketBadge status={current.status} />
              <PriorityBadge priority={current.priority} />
              <span className="text-xs text-slate-400">
                Raised {formatDateTime(current.createdAt)}
              </span>
            </div>

            <ol className="space-y-3">
              {current.messages.map((message) => {
                const fromMe = message.authorRole === 'advisor';
                return (
                  <li key={message.id} className={cn('flex gap-2.5', fromMe && 'flex-row-reverse')}>
                    <Avatar
                      name={message.author}
                      color={fromMe ? 'bg-brand-600' : 'bg-slate-800'}
                      size="sm"
                    />
                    <div
                      className={cn(
                        'min-w-0 max-w-[85%] rounded-xl px-3.5 py-2.5',
                        fromMe ? 'bg-brand-50' : 'bg-slate-100',
                      )}
                    >
                      <p className="text-[13px] leading-relaxed text-slate-700">{message.body}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {message.author} · {formatDateTime(message.at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {current.status !== 'Closed' && (
              <div className="border-t border-slate-100 pt-4">
                <SectionTitle>Reply</SectionTitle>
                <Textarea
                  rows={3}
                  placeholder="Add more detail for the support desk…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* New ticket */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Raise a support ticket"
        description="Tag an application where relevant so the desk has the full context."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!form.subject.trim() || !form.category || !form.body.trim()}
            >
              Submit ticket
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Subject"
            required
            placeholder="Summarise the issue in one line"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              required
              options={TICKET_CATEGORIES}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as TicketCategory })}
            />
            <Select
              label="Priority"
              options={TICKET_PRIORITIES}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}
            />
          </div>
          <Select
            label="Related application"
            placeholder="Not related to a specific file"
            options={myApplications.map((a) => ({
              value: a.id,
              label: `${a.id} — ${a.customer.fullName}`,
            }))}
            value={form.applicationId}
            onChange={(e) => setForm({ ...form, applicationId: e.target.value })}
          />
          <Textarea
            label="Describe the issue"
            required
            rows={4}
            placeholder="What happened, what you expected, and anything you have already tried…"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>
      </Modal>
    </>
  );
}
