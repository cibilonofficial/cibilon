import { useMemo, useState } from 'react';
import { Building2, Clock, Handshake, Mail, Pencil, Phone, Plus } from 'lucide-react';
import { FilterBar } from '@/components/crm/FilterBar';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, DetailItem } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, PageHeader, SectionTitle } from '@/components/ui/Misc';
import { StatCard } from '@/components/ui/StatCard';
import { Chip, LenderBadge } from '@/components/ui/StatusBadge';
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
import { useToast } from '@/components/ui/Toast';
import { LENDER_STATUSES, LENDER_TYPES, SERVICES } from '@/lib/constants';
import { formatDate, matchesQuery, uid } from '@/lib/utils';
import { useData } from '@/store/DataContext';
import type { Lender, LenderStatus, LenderType, ServiceType } from '@/types';

const BLANK: Lender = {
  id: '',
  name: '',
  type: 'Bank',
  status: 'Active',
  services: [],
  commission: {},
  turnaroundDays: 7,
  contactPerson: '',
  email: '',
  phone: '',
  city: '',
  empanelledOn: '',
  notes: '',
};

export function AdminLenders() {
  const toast = useToast();
  const { lenders, applications, saveLender, setLenderStatus, loading } = useData();

  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [selected, setSelected] = useState<Lender | null>(null);
  const [draft, setDraft] = useState<Lender | null>(null);

  const volume = useMemo(() => {
    const map = new Map<string, { files: number; disbursed: number }>();
    applications.forEach((app) => {
      const entry = map.get(app.lender) ?? { files: 0, disbursed: 0 };
      entry.files += 1;
      if (['Disbursed', 'Completed'].includes(app.status)) entry.disbursed += 1;
      map.set(app.lender, entry);
    });
    return map;
  }, [applications]);

  const rows = useMemo(
    () =>
      lenders
        .filter((l) => matchesQuery(query, l.name, l.city, l.contactPerson, l.email, l.type))
        .filter((l) => (type ? l.type === type : true))
        .filter((l) => (status ? l.status === status : true))
        .filter((l) => (service ? l.services.includes(service as ServiceType) : true)),
    [lenders, query, type, status, service],
  );

  const totals = {
    total: lenders.length,
    active: lenders.filter((l) => l.status === 'Active').length,
    paused: lenders.filter((l) => l.status !== 'Active').length,
    avgTat: lenders.length
      ? Math.round(lenders.reduce((sum, l) => sum + l.turnaroundDays, 0) / lenders.length)
      : 0,
  };

  const openNew = () =>
    setDraft({ ...BLANK, id: uid('LN').toUpperCase(), empanelledOn: new Date().toISOString() });

  const saveDraft = () => {
    if (!draft || !draft.name.trim()) return;
    const existing = lenders.some((l) => l.id === draft.id);
    saveLender({ ...draft, name: draft.name.trim() });
    toast.success(
      existing ? 'Lender updated' : 'Lender empanelled',
      `${draft.name} now offers ${draft.services.length} service(s).`,
    );
    setDraft(null);
    setSelected(null);
  };

  const toggleService = (svc: ServiceType) => {
    if (!draft) return;
    const has = draft.services.includes(svc);
    setDraft({
      ...draft,
      services: has ? draft.services.filter((s) => s !== svc) : [...draft.services, svc],
    });
  };

  return (
    <>
      <PageHeader
        title="Lenders & partners"
        description="The empanelled panel, what each partner underwrites and how quickly they turn files around."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={openNew}>
            Add lender
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Partners"
          value={totals.total}
          icon={<Handshake className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Active"
          value={totals.active}
          icon={<Handshake className="size-4" />}
          tone="money"
        />
        <StatCard
          label="Paused / inactive"
          value={totals.paused}
          icon={<Handshake className="size-4" />}
          tone="warn"
        />
        <StatCard
          label="Average turnaround"
          value={`${totals.avgTat} days`}
          icon={<Clock className="size-4" />}
          tone="neutral"
        />
      </div>

      <Card className="mt-3">
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search by lender, city or relationship contact…"
          selects={[
            { id: 'type', label: 'All types', value: type, options: LENDER_TYPES, onChange: setType },
            {
              id: 'status',
              label: 'All states',
              value: status,
              options: LENDER_STATUSES,
              onChange: setStatus,
            },
            {
              id: 'service',
              label: 'All services',
              value: service,
              options: SERVICES,
              onChange: setService,
            },
          ]}
          onReset={() => {
            setType('');
            setStatus('');
            setService('');
          }}
          activeCount={[type, status, service].filter(Boolean).length}
        />

        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Handshake className="size-5" />}
            title="No partners match"
            description="Try clearing the service or status filter."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Lender</TH>
                  <TH>Type</TH>
                  <TH>Services offered</TH>
                  <TH align="right">Files logged</TH>
                  <TH align="right">Disbursed</TH>
                  <TH align="right">TAT</TH>
                  <TH>Status</TH>
                  <TH align="right">Action</TH>
                </THead>
                <TBody>
                  {rows.map((lender) => {
                    const stats = volume.get(lender.name) ?? { files: 0, disbursed: 0 };
                    return (
                      <TR key={lender.id} onClick={() => setSelected(lender)}>
                        <TD>
                          <span className="flex items-center gap-2.5">
                            <Avatar name={lender.name} color="bg-slate-800" size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-slate-900">
                                {lender.name}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {lender.city} · {lender.contactPerson}
                              </span>
                            </span>
                          </span>
                        </TD>
                        <TD>{lender.type}</TD>
                        <TD className="max-w-[18rem]">
                          <span className="flex flex-wrap gap-1">
                            {lender.services.slice(0, 3).map((s) => (
                              <Chip key={s} tone="neutral">
                                {s}
                              </Chip>
                            ))}
                            {lender.services.length > 3 && (
                              <Chip tone="brand">+{lender.services.length - 3}</Chip>
                            )}
                          </span>
                        </TD>
                        <TD align="right" className="tnum">
                          {stats.files}
                        </TD>
                        <TD align="right" className="tnum">
                          {stats.disbursed}
                        </TD>
                        <TD align="right" className="tnum whitespace-nowrap">
                          {lender.turnaroundDays}d
                        </TD>
                        <TD>
                          <LenderBadge status={lender.status} />
                        </TD>
                        <TD align="right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Pencil className="size-3.5" />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDraft(lender);
                              }}
                            >
                              Edit
                            </Button>
                            <select
                              value={lender.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                setLenderStatus(lender.id, e.target.value as LenderStatus);
                                toast.success('Lender updated', `${lender.name} → ${e.target.value}`);
                              }}
                              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[13px] text-slate-700 focus:border-brand-500 focus:outline-none"
                            >
                              {LENDER_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </TableWrap>
            </div>

            <MobileCardList className="lg:hidden">
              {rows.map((lender) => (
                <MobileRow
                  key={lender.id}
                  onClick={() => setSelected(lender)}
                  title={lender.name}
                  subtitle={`${lender.type} · ${lender.city}`}
                  badge={<LenderBadge status={lender.status} />}
                  rows={[
                    { label: 'Services', value: lender.services.length },
                    { label: 'Turnaround', value: `${lender.turnaroundDays} days` },
                    { label: 'Contact', value: lender.contactPerson },
                    { label: 'Empanelled', value: formatDate(lender.empanelledOn) },
                  ]}
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDraft(lender);
                      }}
                    >
                      Edit
                    </Button>
                  }
                />
              ))}
            </MobileCardList>
          </>
        )}
      </Card>

      {/* Detail */}
      <Modal
        open={Boolean(selected) && !draft}
        onClose={() => setSelected(null)}
        size="lg"
        title={selected?.name ?? ''}
        description={selected ? `${selected.type} · empanelled ${formatDate(selected.empanelledOn)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
            <Button icon={<Pencil className="size-4" />} onClick={() => setDraft(selected)}>
              Edit lender
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <LenderBadge status={selected.status} />
              <Chip tone="brand">{selected.type}</Chip>
              <Chip tone="neutral">{selected.turnaroundDays} day turnaround</Chip>
            </div>

            <Card>
              <CardBody>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <DetailItem
                    label="Relationship manager"
                    value={
                      <span className="flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-slate-400" />
                        {selected.contactPerson}
                      </span>
                    }
                  />
                  <DetailItem
                    label="Phone"
                    value={
                      <span className="flex items-center gap-1.5">
                        <Phone className="size-3.5 text-slate-400" />
                        {selected.phone}
                      </span>
                    }
                  />
                  <DetailItem
                    label="Email"
                    value={
                      <span className="flex items-center gap-1.5">
                        <Mail className="size-3.5 text-slate-400" />
                        {selected.email}
                      </span>
                    }
                  />
                  <DetailItem label="City" value={selected.city} />
                </dl>
              </CardBody>
            </Card>

            <div>
              <SectionTitle>Services & commission</SectionTitle>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {selected.services.map((svc) => (
                  <li key={svc} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-[13px] text-slate-700">{svc}</span>
                    <span className="tnum text-[13px] font-medium text-money-700">
                      {selected.commission[svc] ? `${selected.commission[svc]}%` : 'Flat payout'}
                    </span>
                  </li>
                ))}
                {selected.services.length === 0 && (
                  <li className="px-3 py-4 text-center text-[13px] text-slate-400">
                    No services configured.
                  </li>
                )}
              </ul>
            </div>

            {selected.notes && (
              <div>
                <SectionTitle>Desk notes</SectionTitle>
                <p className="rounded-lg bg-slate-50 px-3.5 py-3 text-[13px] leading-relaxed text-slate-600">
                  {selected.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add / edit */}
      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        size="lg"
        title={draft && lenders.some((l) => l.id === draft.id) ? 'Edit lender' : 'Add a lender'}
        description="Panel details drive the lender picker on the advisor lead form."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={saveDraft} disabled={!draft?.name.trim()}>
              Save lender
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Lender name"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <Select
                label="Type"
                options={LENDER_TYPES}
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as LenderType })}
              />
              <Input
                label="Relationship manager"
                value={draft.contactPerson}
                onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })}
              />
              <Input
                label="City"
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              />
              <Input
                label="Email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
              <Input
                label="Phone"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
              <Input
                label="Turnaround (days)"
                type="number"
                min={1}
                value={draft.turnaroundDays}
                onChange={(e) =>
                  setDraft({ ...draft, turnaroundDays: Number(e.target.value) || 1 })
                }
              />
              <Select
                label="Status"
                options={LENDER_STATUSES}
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as LenderStatus })}
              />
            </div>

            <div>
              <SectionTitle>Services offered</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-2">
                {SERVICES.map((svc) => {
                  const on = draft.services.includes(svc);
                  return (
                    <div
                      key={svc}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <Checkbox label={svc} checked={on} onChange={() => toggleService(svc)} />
                      {on && (
                        <input
                          type="number"
                          step="0.05"
                          min={0}
                          aria-label={`${svc} commission percentage`}
                          value={draft.commission[svc] ?? 0}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              commission: { ...draft.commission, [svc]: Number(e.target.value) },
                            })
                          }
                          className="h-8 w-20 rounded-md border border-slate-300 px-2 text-right text-[13px] text-slate-700 focus:border-brand-500 focus:outline-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Commission is the percentage of the disbursed amount paid to Cibilon.
              </p>
            </div>

            <Textarea
              label="Desk notes"
              rows={3}
              placeholder="Anything the ops team should know before logging a file here…"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
