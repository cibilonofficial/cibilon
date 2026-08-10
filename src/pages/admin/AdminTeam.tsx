import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, Plus, ShieldCheck, UserCog, UsersRound } from 'lucide-react';
import { FilterBar } from '@/components/crm/FilterBar';
import { AssignStaffModal } from '@/components/crm/AssignStaffModal';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, DetailItem } from '@/components/ui/Card';
import { EmptyState, TableSkeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Avatar, PageHeader, SectionTitle } from '@/components/ui/Misc';
import { StatCard } from '@/components/ui/StatCard';
import { Chip, StatusBadge } from '@/components/ui/StatusBadge';
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
import { ROLE_PERMISSIONS, STAFF_ROLES } from '@/lib/constants';
import { formatDate, matchesQuery, nowIso, uid } from '@/lib/utils';
import { useMockLoading } from '@/hooks/useMockLoading';
import { useData } from '@/store/DataContext';
import type { Application, StaffMember, StaffRole } from '@/types';

const AVATAR_COLORS = [
  'bg-brand-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
];

const EMPTY_FORM = {
  name: '',
  email: '',
  mobile: '',
  role: '' as StaffRole | '',
  department: '',
};

export function AdminTeam() {
  const navigate = useNavigate();
  const toast = useToast();
  const { staff, applications, saveStaffMember, setStaffStatus } = useData();
  const loading = useMockLoading();

  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toggling, setToggling] = useState<StaffMember | null>(null);
  const [assigning, setAssigning] = useState<Application | null>(null);

  const workload = useMemo(() => {
    const map = new Map<string, { open: number; total: number }>();
    applications.forEach((app) => {
      if (!app.assignedStaffId) return;
      const entry = map.get(app.assignedStaffId) ?? { open: 0, total: 0 };
      entry.total += 1;
      if (!['Disbursed', 'Completed', 'Rejected'].includes(app.status)) entry.open += 1;
      map.set(app.assignedStaffId, entry);
    });
    return map;
  }, [applications]);

  const rows = useMemo(
    () =>
      staff
        .filter((s) => matchesQuery(query, s.name, s.code, s.email, s.role, s.department))
        .filter((s) => (role ? s.role === role : true))
        .filter((s) => (status ? s.status === status : true)),
    [staff, query, role, status],
  );

  const unassigned = useMemo(
    () =>
      applications.filter(
        (a) => !a.assignedStaffId && !['Draft', 'Completed', 'Rejected'].includes(a.status),
      ),
    [applications],
  );

  const totals = {
    total: staff.length,
    active: staff.filter((s) => s.status === 'Active').length,
    assigned: applications.filter((a) => a.assignedStaffId).length,
    unassigned: unassigned.length,
  };

  const submitForm = () => {
    if (!form.name.trim() || !form.role) return;
    const member: StaffMember = {
      id: uid('EMP').toUpperCase(),
      name: form.name.trim(),
      code: `${form.role.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 899)}`,
      email: form.email.trim() || `${form.name.trim().toLowerCase().replace(/\s+/g, '.')}@cibilon.in`,
      mobile: form.mobile.trim() || '+91 90000 00000',
      role: form.role,
      department: form.department.trim() || 'Operations',
      status: 'Active',
      joinedOn: nowIso(),
      avatarColor: AVATAR_COLORS[staff.length % AVATAR_COLORS.length],
    };
    saveStaffMember(member);
    setForm(EMPTY_FORM);
    setFormOpen(false);
    toast.success('Staff member added', `${member.name} can now be assigned applications.`);
  };

  const confirmToggle = () => {
    if (!toggling) return;
    const next = toggling.status === 'Active' ? 'Inactive' : 'Active';
    setStaffStatus(toggling.id, next);
    toast.success(
      next === 'Active' ? 'Staff member activated' : 'Staff member deactivated',
      `${toggling.name} is now ${next.toLowerCase()}.`,
    );
    setToggling(null);
  };

  return (
    <>
      <PageHeader
        title="Team / Staff"
        description="The internal processing team, what each role can do, and who is carrying which files."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>
            Add staff member
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Team size"
          value={totals.total}
          icon={<UsersRound className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Active"
          value={totals.active}
          icon={<ShieldCheck className="size-4" />}
          tone="money"
        />
        <StatCard
          label="Assigned files"
          value={totals.assigned}
          icon={<UserCog className="size-4" />}
          tone="neutral"
        />
        <StatCard
          label="Awaiting assignment"
          value={totals.unassigned}
          icon={<UserCog className="size-4" />}
          tone="warn"
        />
      </div>

      <Card className="mt-3">
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          placeholder="Search by name, code, email or department…"
          selects={[
            {
              id: 'role',
              label: 'All roles',
              value: role,
              options: STAFF_ROLES,
              onChange: setRole,
            },
            {
              id: 'status',
              label: 'All states',
              value: status,
              options: ['Active', 'Inactive'],
              onChange: setStatus,
            },
          ]}
          onReset={() => {
            setRole('');
            setStatus('');
          }}
          activeCount={[role, status].filter(Boolean).length}
        />

        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<UsersRound className="size-5" />}
            title="No staff match"
            description="Try a different search term or clear the role filter."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <TableWrap className="min-w-full">
                <THead>
                  <TH>Member</TH>
                  <TH>Role</TH>
                  <TH>Department</TH>
                  <TH>Contact</TH>
                  <TH align="right">Open files</TH>
                  <TH align="right">Total handled</TH>
                  <TH>Status</TH>
                  <TH align="right">Action</TH>
                </THead>
                <TBody>
                  {rows.map((member) => {
                    const load = workload.get(member.id) ?? { open: 0, total: 0 };
                    return (
                      <TR key={member.id} onClick={() => setSelected(member)}>
                        <TD>
                          <span className="flex items-center gap-2.5">
                            <Avatar name={member.name} color={member.avatarColor} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-slate-900">
                                {member.name}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {member.code}
                              </span>
                            </span>
                          </span>
                        </TD>
                        <TD>{member.role}</TD>
                        <TD className="text-slate-600">{member.department}</TD>
                        <TD>
                          <span className="tnum block text-[13px] text-slate-700">
                            {member.mobile}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {member.email}
                          </span>
                        </TD>
                        <TD align="right" className="tnum">
                          {load.open}
                        </TD>
                        <TD align="right" className="tnum">
                          {load.total}
                        </TD>
                        <TD>
                          <Chip tone={member.status === 'Active' ? 'money' : 'neutral'}>
                            {member.status}
                          </Chip>
                        </TD>
                        <TD align="right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(member);
                              }}
                            >
                              View
                            </Button>
                            <Button
                              variant={member.status === 'Active' ? 'ghost' : 'success'}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setToggling(member);
                              }}
                            >
                              {member.status === 'Active' ? 'Deactivate' : 'Activate'}
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
              {rows.map((member) => {
                const load = workload.get(member.id) ?? { open: 0, total: 0 };
                return (
                  <MobileRow
                    key={member.id}
                    onClick={() => setSelected(member)}
                    title={member.name}
                    subtitle={`${member.code} · ${member.role}`}
                    badge={
                      <Chip tone={member.status === 'Active' ? 'money' : 'neutral'}>
                        {member.status}
                      </Chip>
                    }
                    rows={[
                      { label: 'Department', value: member.department },
                      { label: 'Open files', value: load.open },
                      { label: 'Total handled', value: load.total },
                      { label: 'Joined', value: formatDate(member.joinedOn) },
                    ]}
                  />
                );
              })}
            </MobileCardList>
          </>
        )}
      </Card>

      <Card className="mt-3">
        <CardHeader
          title="Awaiting assignment"
          subtitle="Live files with no owner on the processing desk"
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/admin/applications')}>
              All applications
            </Button>
          }
        />
        {unassigned.length === 0 ? (
          <EmptyState
            icon={<UserCog className="size-5" />}
            title="Every live file has an owner"
            description="New submissions will show up here until someone picks them up."
          />
        ) : (
          <TableWrap className="min-w-full">
            <THead>
              <TH>Application</TH>
              <TH>Customer</TH>
              <TH>Advisor</TH>
              <TH>Service</TH>
              <TH>Status</TH>
              <TH align="right">Action</TH>
            </THead>
            <TBody>
              {unassigned.slice(0, 8).map((app) => (
                <TR key={app.id}>
                  <TD className="font-medium text-slate-900">{app.id}</TD>
                  <TD>{app.customer.fullName}</TD>
                  <TD className="text-slate-600">{app.advisorName}</TD>
                  <TD>{app.service}</TD>
                  <TD>
                    <StatusBadge status={app.status} />
                  </TD>
                  <TD align="right">
                    <Button variant="secondary" size="sm" onClick={() => setAssigning(app)}>
                      Assign
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </TableWrap>
        )}
      </Card>

      {/* Member detail */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        size="lg"
        title={selected?.name ?? ''}
        description={selected ? `${selected.code} · ${selected.role}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
            {selected && (
              <Button
                variant={selected.status === 'Active' ? 'danger' : 'success'}
                onClick={() => {
                  setToggling(selected);
                  setSelected(null);
                }}
              >
                {selected.status === 'Active' ? 'Deactivate' : 'Activate'}
              </Button>
            )}
          </>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar name={selected.name} color={selected.avatarColor} size="xl" />
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">{selected.name}</p>
                <p className="text-[13px] text-slate-500">{selected.department}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Chip tone="brand">{selected.role}</Chip>
                  <Chip tone={selected.status === 'Active' ? 'money' : 'neutral'}>
                    {selected.status}
                  </Chip>
                </div>
              </div>
            </div>

            <Card>
              <CardBody>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <DetailItem
                    label="Email"
                    value={
                      <span className="flex items-center gap-1.5">
                        <Mail className="size-3.5 text-slate-400" />
                        {selected.email}
                      </span>
                    }
                  />
                  <DetailItem
                    label="Mobile"
                    value={
                      <span className="flex items-center gap-1.5">
                        <Phone className="size-3.5 text-slate-400" />
                        {selected.mobile}
                      </span>
                    }
                  />
                  <DetailItem label="Employee code" value={selected.code} mono />
                  <DetailItem label="Joined on" value={formatDate(selected.joinedOn)} />
                </dl>
              </CardBody>
            </Card>

            <div>
              <SectionTitle>Permissions for this role</SectionTitle>
              <ul className="grid gap-2 sm:grid-cols-2">
                {ROLE_PERMISSIONS[selected.role].map((permission) => (
                  <li
                    key={permission}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700"
                  >
                    <ShieldCheck className="size-3.5 shrink-0 text-money-600" />
                    {permission}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <SectionTitle>Assigned applications</SectionTitle>
              {applications.filter((a) => a.assignedStaffId === selected.id).length === 0 ? (
                <p className="text-[13px] text-slate-500">No files are currently assigned.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {applications
                    .filter((a) => a.assignedStaffId === selected.id)
                    .slice(0, 8)
                    .map((app) => (
                      <li key={app.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(null);
                            navigate(`/admin/applications/${app.id}`);
                          }}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-slate-800">
                              {app.customer.fullName}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {app.id} · {app.service}
                            </span>
                          </span>
                          <StatusBadge status={app.status} />
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add staff */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add a staff member"
        description="They can be assigned applications as soon as they are active."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={!form.name.trim() || !form.role}>
              Add member
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            containerClassName="sm:col-span-2"
          />
          <Select
            label="Role"
            required
            options={STAFF_ROLES}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
          />
          <Input
            label="Department"
            placeholder="Operations"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            placeholder="name@cibilon.in"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Mobile"
            placeholder="+91 90000 00000"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.status === 'Active' ? 'Deactivate this member?' : 'Activate this member?'}
        message={
          toggling?.status === 'Active'
            ? `${toggling?.name} will stop appearing in the assignment picker. Files already with them stay assigned.`
            : `${toggling?.name} will be able to receive application assignments again.`
        }
        confirmLabel={toggling?.status === 'Active' ? 'Deactivate' : 'Activate'}
        tone={toggling?.status === 'Active' ? 'danger' : 'primary'}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />

      <AssignStaffModal application={assigning} onClose={() => setAssigning(null)} />
    </>
  );
}
