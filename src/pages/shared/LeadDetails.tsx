import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  FileStack,
  ListChecks,
  Mail,
  MessageSquarePlus,
  Phone,
  UserCog,
} from 'lucide-react';
import { AssignStaffModal } from '@/components/crm/AssignStaffModal';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, DetailItem } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Select, Textarea } from '@/components/ui/Field';
import { Avatar, PageHeader, ProgressBar, SectionTitle, Tabs } from '@/components/ui/Misc';
import {
  Chip,
  DocStatusBadge,
  LeadStageBadge,
  StatusBadge,
} from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { LEAD_STAGES } from '@/lib/constants';
import { formatCurrency, formatDate, formatDateTime, maskId, relativeTime } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import type { LeadActivityKind, LeadStage } from '@/types';

const ACTIVITY_KINDS: LeadActivityKind[] = ['Call', 'Meeting', 'Email', 'Note'];

export function LeadDetails() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const {
    applicationById,
    documentsFor,
    activitiesFor,
    payoutFor,
    advisors,
    updateLeadStage,
    addLeadActivity,
  } = useData();

  const isAdmin = user?.role === 'admin';
  const base = isAdmin ? '/admin' : '/app';

  const lead = applicationById(id);
  const [tab, setTab] = useState('overview');
  const [kind, setKind] = useState<LeadActivityKind>('Call');
  const [note, setNote] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);

  if (!lead) {
    return (
      <Card>
        <EmptyState
          icon={<ListChecks className="size-5" />}
          title="Lead not found"
          description={`We could not find a lead with the ID “${id}”.`}
          action={
            <Button variant="secondary" onClick={() => navigate(`${base}/leads`)}>
              Back to leads
            </Button>
          }
        />
      </Card>
    );
  }

  const documents = documentsFor(lead.id);
  const activities = activitiesFor(lead.id);
  const payout = payoutFor(lead.id);
  const advisor = advisors.find((a) => a.id === lead.advisorId);
  const verified = documents.filter((d) => d.status === 'Verified').length;

  const changeStage = (stage: LeadStage) => {
    updateLeadStage(lead.id, stage);
    toast.success('Lead stage updated', `${lead.leadId} is now ${stage}.`);
  };

  const logActivity = () => {
    if (!note.trim()) return;
    addLeadActivity(lead.id, kind, note.trim(), user!.name);
    setNote('');
    toast.success('Activity logged', `${kind} recorded against ${lead.leadId}.`);
  };

  return (
    <>
      <PageHeader
        breadcrumb={
          <nav className="mb-1.5 flex items-center gap-1 text-xs text-slate-500">
            <Link to={`${base}/leads`} className="hover:text-slate-800">
              Leads
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-slate-700">{lead.leadId}</span>
          </nav>
        }
        title={lead.customer.fullName}
        description={`${lead.leadId} · ${lead.service} · sourced ${formatDate(lead.createdAt)} via ${lead.source}`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate(`${base}/leads`)}
            >
              Back
            </Button>
            {isAdmin && (
              <Button
                variant="secondary"
                icon={<UserCog className="size-4" />}
                onClick={() => setAssignOpen(true)}
              >
                Assign
              </Button>
            )}
            <Button
              icon={<FileStack className="size-4" />}
              onClick={() => navigate(`${base}/applications/${lead.id}`)}
            >
              Open application
            </Button>
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Lead stage" value={<LeadStageBadge stage={lead.leadStage} />} hint={`Updated ${relativeTime(lead.updatedAt)}`} />
        <Tile label="Application status" value={<StatusBadge status={lead.status} />} hint={lead.processingStage} />
        <Tile
          label={lead.loanAmount ? 'Requested amount' : 'Service'}
          value={
            <span className="tnum text-lg font-semibold text-slate-900">
              {lead.loanAmount ? formatCurrency(lead.loanAmount) : lead.service}
            </span>
          }
          hint={lead.serviceDetails.tenure ? `${lead.serviceDetails.tenure} months tenure` : lead.lender}
        />
        <Tile
          label="Expected payout"
          value={
            <span className="tnum text-lg font-semibold text-money-700">
              {formatCurrency(lead.expectedPayout)}
            </span>
          }
          hint={payout ? `Payout ${payout.status.toLowerCase()}` : 'On disbursal'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="px-4 pt-1 sm:px-5">
            <Tabs
              tabs={[
                { id: 'overview', label: 'Lead details' },
                { id: 'activity', label: 'Activity', count: activities.length },
                { id: 'documents', label: 'Documents', count: documents.length },
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>

          {tab === 'overview' && (
            <CardBody className="space-y-6">
              <section>
                <SectionTitle>Customer</SectionTitle>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label="Full name" value={lead.customer.fullName} />
                  <DetailItem label="Mobile" value={lead.customer.mobile} mono />
                  <DetailItem label="Email" value={lead.customer.email} />
                  <DetailItem label="Date of birth" value={formatDate(lead.customer.dob)} />
                  <DetailItem label="Gender" value={lead.customer.gender} />
                  <DetailItem label="PAN" value={maskId(lead.customer.pan)} mono />
                  <DetailItem
                    label="Address"
                    value={`${lead.customer.address}, ${lead.customer.city}, ${lead.customer.state} ${lead.customer.pincode}`}
                    className="sm:col-span-2"
                  />
                </dl>
              </section>

              <section className="border-t border-slate-100 pt-5">
                <SectionTitle>Requirement</SectionTitle>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label="Service" value={lead.service} />
                  <DetailItem
                    label="Amount"
                    value={lead.loanAmount ? formatCurrency(lead.loanAmount) : '—'}
                  />
                  <DetailItem
                    label="Tenure"
                    value={lead.serviceDetails.tenure ? `${lead.serviceDetails.tenure} months` : '—'}
                  />
                  <DetailItem label="Purpose" value={lead.serviceDetails.purpose} />
                  <DetailItem label="Preferred lender" value={lead.lender} />
                  <DetailItem label="Source" value={lead.source} />
                </dl>
              </section>

              <section className="border-t border-slate-100 pt-5">
                <SectionTitle>Employment & financials</SectionTitle>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label="Employment type" value={lead.employment.employmentType} />
                  <DetailItem
                    label="Monthly income"
                    value={formatCurrency(Number(lead.employment.monthlyIncome))}
                  />
                  <DetailItem label="Organisation" value={lead.employment.organisation} />
                  <DetailItem label="Existing loans" value={lead.employment.existingLoans} />
                  <DetailItem label="Existing EMI" value={lead.employment.existingEmi} />
                  <DetailItem label="Credit score" value={lead.employment.creditScore} />
                </dl>
              </section>
            </CardBody>
          )}

          {tab === 'activity' && (
            <CardBody className="space-y-5">
              <div className="rounded-xl border border-slate-200 p-4">
                <SectionTitle>Log an activity</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <Select
                    label="Type"
                    options={ACTIVITY_KINDS}
                    value={kind}
                    onChange={(e) => setKind(e.target.value as LeadActivityKind)}
                  />
                  <Textarea
                    label="What happened?"
                    rows={2}
                    placeholder="Spoke to the customer about the document checklist…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    icon={<MessageSquarePlus className="size-4" />}
                    disabled={!note.trim()}
                    onClick={logActivity}
                  >
                    Add to timeline
                  </Button>
                </div>
              </div>

              {activities.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="size-5" />}
                  title="No activity logged yet"
                  description="Calls, meetings and notes you record against this lead show up here."
                />
              ) : (
                <ol className="space-y-4">
                  {activities.map((activity) => (
                    <li key={activity.id} className="flex gap-3">
                      <span className="mt-1 shrink-0">
                        <Chip tone={activity.kind === 'Stage' ? 'brand' : 'neutral'}>
                          {activity.kind}
                        </Chip>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] leading-relaxed text-slate-700">{activity.note}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {formatDateTime(activity.at)} · {activity.actor}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          )}

          {tab === 'documents' && (
            <CardBody>
              {documents.length === 0 ? (
                <EmptyState
                  icon={<FileStack className="size-5" />}
                  title="No documents yet"
                  description="Documents attached to this lead's application will appear here."
                />
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-800">{doc.name}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {doc.fileName || 'Not uploaded yet'}
                        </p>
                      </div>
                      <DocStatusBadge status={doc.status} />
                    </div>
                  ))}
                  <div className="pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`${base}/applications/${lead.id}`)}
                    >
                      Manage documents on the application
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          )}
        </Card>

        <div className="min-w-0 space-y-3">
          <Card>
            <CardHeader title="Pipeline stage" subtitle="Where this lead sits today" />
            <CardBody className="space-y-3">
              <Select
                label="Lead stage"
                options={LEAD_STAGES}
                value={lead.leadStage}
                onChange={(e) => changeStage(e.target.value as LeadStage)}
              />
              <div className="flex flex-wrap gap-1.5">
                {LEAD_STAGES.map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => changeStage(stage)}
                    className="rounded-md px-1.5 py-0.5 transition-opacity hover:opacity-80"
                    aria-label={`Set stage to ${stage}`}
                  >
                    <LeadStageBadge
                      stage={stage}
                      className={stage === lead.leadStage ? '' : 'opacity-45'}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Changing the stage is logged against the lead and appears in the audit trail.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Ownership" />
            <CardBody className="space-y-3.5">
              <DetailItem label="Assigned to" value={lead.assignedTo} />
              <DetailItem label="Processing stage" value={lead.processingStage} />
              <DetailItem label="Last updated" value={formatDateTime(lead.updatedAt)} />
              {isAdmin && (
                <Button variant="secondary" size="sm" fullWidth onClick={() => setAssignOpen(true)}>
                  Change assignment
                </Button>
              )}
            </CardBody>
          </Card>

          {advisor && (
            <Card>
              <CardHeader title="Advisor" />
              <CardBody>
                <div className="flex items-center gap-3">
                  <Avatar name={advisor.name} color={advisor.avatarColor} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{advisor.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {advisor.code} · {advisor.agency}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-[13px]">
                  <a
                    href={`tel:${lead.customer.mobile}`}
                    className="flex items-center gap-2 text-slate-600 hover:text-brand-700"
                  >
                    <Phone className="size-3.5 text-slate-400" />
                    Call customer · {lead.customer.mobile}
                  </a>
                  <a
                    href={`mailto:${lead.customer.email}`}
                    className="flex items-center gap-2 truncate text-slate-600 hover:text-brand-700"
                  >
                    <Mail className="size-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{lead.customer.email}</span>
                  </a>
                </div>
                {isAdmin && (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    className="mt-3"
                    onClick={() => navigate(`/admin/advisors/${advisor.id}`)}
                  >
                    View advisor profile
                  </Button>
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Document readiness" />
            <CardBody>
              <ProgressBar
                value={verified}
                max={Math.max(1, documents.length)}
                tone={verified === documents.length ? 'money' : 'brand'}
                label={
                  <span>
                    {verified}/{documents.length} verified
                  </span>
                }
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <AssignStaffModal application={assignOpen ? lead : null} onClose={() => setAssignOpen(false)} />
    </>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="card-surface px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1.5">{value}</div>
      {hint && <p className="mt-1 truncate text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
