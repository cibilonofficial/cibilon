import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  ChevronRight,
  Download,
  Eye,
  FilePlus2,
  FileStack,
  FileText,
  Landmark,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  UserCog,
  UserRound,
  Wallet,
} from 'lucide-react';
import { AssignStaffModal } from '@/components/crm/AssignStaffModal';
import { DocumentPreviewModal } from '@/components/crm/DocumentPreviewModal';
import { RequestDocumentModal } from '@/components/crm/RequestDocumentModal';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, DetailItem } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Select, Textarea } from '@/components/ui/Field';
import { FileTypeIcon, validateFile } from '@/components/ui/FileUpload';
import { Modal } from '@/components/ui/Modal';
import { Avatar, PageHeader, ProgressBar, SectionTitle, Tabs } from '@/components/ui/Misc';
import { DocStatusBadge, PayoutBadge, StatusBadge } from '@/components/ui/StatusBadge';
import { ActivityLog, ApplicationTimeline } from '@/components/ui/Timeline';
import { useToast } from '@/components/ui/Toast';
import { APPLICATION_STATUS_TRANSITIONS } from '@/lib/constants';
import {
  formatBytes,
  formatCurrency,
  formatDate,
  formatDateTime,
  maskId,
  relativeTime,
} from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { categoryFor } from '../../../shared/service-categories';
import { CategoryDetails } from '@/components/crm/CategoryFields';
import type { AppDocument, ApplicationStatus } from '@/types';

export function ApplicationDetails() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const {
    applicationById,
    documentsFor,
    payoutFor,
    advisors,
    replaceDocument,
    updateApplicationStatus,
  } = useData();

  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const canUpdate = isAdmin || Boolean(user?.permissions.includes('applications:status:update'));
  const canRequest = isAdmin || Boolean(user?.permissions.includes('documents:request'));
  const base = isAdmin ? '/admin' : isStaff ? '/staff' : '/app';

  const application = applicationById(id);
  const documents = documentsFor(id);
  const payout = payoutFor(id);

  const [tab, setTab] = useState('overview');
  const [statusModal, setStatusModal] = useState(false);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus | ''>('');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [reuploadTarget, setReuploadTarget] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [previewing, setPreviewing] = useState<AppDocument | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const advisor = useMemo(
    () => advisors.find((a) => a.id === application?.advisorId),
    [advisors, application],
  );

  const verified = documents.filter((d) => d.status === 'Verified').length;
  const missing = documents.filter(
    (d) => d.status === 'Pending' || d.status === 'Re-upload Required' || d.status === 'Rejected',
  );

  if (!application) {
    return (
      <Card>
        <EmptyState
          icon={<FileStack className="size-5" />}
          title="Application not found"
          description={`We could not find an application with the ID “${id}”.`}
          action={
            <Button variant="secondary" onClick={() => navigate(`${base}/applications`)}>
              Back to applications
            </Button>
          }
        />
      </Card>
    );
  }

  const submitStatusChange = async () => {
    if (!nextStatus) return;
    setSaving(true);
    try {
      await updateApplicationStatus(application.id, nextStatus, statusRemarks, user!.name);
      setStatusModal(false); setStatusRemarks(''); setNextStatus('');
      toast.success('Status updated', `${application.id} is now ${nextStatus}.`);
    } catch (error) {
      toast.error('Status not updated', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };

  const handleReupload = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !reuploadTarget) return;
    const problem = validateFile(file);
    if (problem) {
      toast.error('File rejected', problem);
      return;
    }
    replaceDocument(reuploadTarget, {
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      size: file.size,
      file,
    });
    setReuploadTarget(null);
    toast.success('Document re-uploaded', 'It has gone back to the verification desk.');
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'documents', label: 'Documents', count: documents.length },
    { id: 'timeline', label: 'Timeline' },
    { id: 'activity', label: 'Activity', count: application.timeline.length },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={
          <nav className="mb-1.5 flex items-center gap-1 text-xs text-slate-500">
            <Link to={`${base}/applications`} className="hover:text-slate-800">
              Applications
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-slate-700">{application.id}</span>
          </nav>
        }
        title={application.customer.fullName}
        description={`${application.service} · ${application.id} · submitted ${formatDate(application.submittedAt)}`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate(`${base}/applications`)}
            >
              Back
            </Button>
            {isAdmin || isStaff ? (
              <>
                {isAdmin && <Button
                  variant="secondary"
                  icon={<UserCog className="size-4" />}
                  onClick={() => setAssignOpen(true)}
                >
                  Assign
                </Button>}
                {canRequest && <Button
                  variant="secondary"
                  icon={<FilePlus2 className="size-4" />}
                  onClick={() => setRequestOpen(true)}
                >
                  Request document
                </Button>}
                {canUpdate && <Button
                  icon={<RefreshCw className="size-4" />}
                  onClick={() => {
                    setNextStatus('');
                    setStatusModal(true);
                  }}
                >
                  Update status
                </Button>}
              </>
            ) : (
              <Button
                variant="secondary"
                icon={<Download className="size-4" />}
                onClick={() => toast.info('Preparing file', 'The summary PDF will download shortly.')}
              >
                Download summary
              </Button>
            )}
          </>
        }
      />

      {/* Status strip */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile
          label="Current status"
          value={<StatusBadge status={application.status} />}
          hint={`Updated ${relativeTime(application.updatedAt)}`}
        />
        <SummaryTile
          label={application.loanAmount ? 'Requested amount' : 'Service'}
          value={
            <span className="tnum text-lg font-semibold text-slate-900">
              {application.loanAmount ? formatCurrency(application.loanAmount) : application.service}
            </span>
          }
          hint={
            application.serviceDetails.tenure
              ? `${application.serviceDetails.tenure} months tenure`
              : application.lender
          }
        />
        <SummaryTile
          label="Documents verified"
          value={
            <span className="tnum text-lg font-semibold text-slate-900">
              {verified}/{documents.length}
            </span>
          }
          hint={
            missing.length
              ? `${missing.length} pending your action`
              : verified < documents.length
                ? `${documents.length - verified} with the verification desk`
                : 'All verified'
          }
        />
        <SummaryTile
          label="Expected payout"
          value={
            <span className="tnum text-lg font-semibold text-money-700">
              {formatCurrency(application.expectedPayout)}
            </span>
          }
          hint={payout ? `Payout ${payout.status.toLowerCase()}` : 'Estimate; final amount confirmed on disbursal'}
        />
      </div>

      {/* Alerts */}
      {(application.status === 'Documents Required' ||
        application.status === 'Additional Information Required') && (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-amber-900">Action required from you</p>
            <p className="mt-1 text-[13px] leading-relaxed text-amber-800">
              {application.adminRemarks}
            </p>
            {application.requiredActions.length > 0 && (
              <ul className="mt-2 space-y-1">
                {application.requiredActions.map((action) => (
                  <li key={action} className="flex items-start gap-1.5 text-[13px] text-amber-800">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-600" />
                    {action}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => setTab('documents')}
          >
            Fix documents
          </Button>
        </div>
      )}

      {application.status === 'Rejected' && (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
          <div>
            <p className="text-[13px] font-semibold text-rose-900">Application rejected</p>
            <p className="mt-1 text-[13px] leading-relaxed text-rose-800">
              {application.adminRemarks}
            </p>
          </div>
        </div>
      )}

      <Card>
        <div className="px-4 pt-1 sm:px-5">
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>

        {tab === 'overview' && (
          <CardBody className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-6">
                <section>
                  <SectionTitle>Customer information</SectionTitle>
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem label="Full name" value={application.customer.fullName} />
                    <DetailItem label="Mobile" value={application.customer.mobile} mono />
                    <DetailItem label="Email" value={application.customer.email} />
                    <DetailItem label="Date of birth" value={formatDate(application.customer.dob)} />
                    <DetailItem label="Gender" value={application.customer.gender} />
                    <DetailItem label="PAN" value={maskId(application.customer.pan)} mono />
                    <DetailItem label="Aadhaar" value={maskId(application.customer.aadhaar)} mono />
                    <DetailItem
                      label="Address"
                      value={`${application.customer.address}, ${application.customer.city}, ${application.customer.state} ${application.customer.pincode}`}
                      className="sm:col-span-2"
                    />
                  </dl>
                </section>

                <section className="border-t border-slate-100 pt-5">
                  <SectionTitle>Employment & financials</SectionTitle>
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem
                      label="Employment type"
                      value={application.employment.employmentType}
                    />
                    <DetailItem
                      label="Monthly income"
                      value={formatCurrency(Number(application.employment.monthlyIncome))}
                    />
                    <DetailItem label="Organisation" value={application.employment.organisation} />
                    <DetailItem
                      label="Experience"
                      value={
                        application.employment.experience
                          ? `${application.employment.experience} years`
                          : ''
                      }
                    />
                    <DetailItem
                      label="Existing loans"
                      value={application.employment.existingLoans}
                    />
                    <DetailItem label="Credit score" value={application.employment.creditScore} />
                    <DetailItem label="Bank" value={application.employment.bankName} />
                    <DetailItem
                      label="Account"
                      value={maskId(application.employment.accountNumber)}
                      mono
                    />
                    <DetailItem label="IFSC" value={application.employment.ifsc} mono />
                  </dl>
                </section>

                <section className="border-t border-slate-100 pt-5">
                  <SectionTitle>Service information</SectionTitle>
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailItem label="Service type" value={application.service} />
                    <DetailItem label="Category" value={categoryFor(application.service, application.serviceDetails.category)} />
                    <CategoryDetails category={categoryFor(application.service, application.serviceDetails.category)} values={application.serviceDetails.categoryFields} />
                    <DetailItem
                      label="Requested amount"
                      value={
                        application.loanAmount ? formatCurrency(application.loanAmount) : '—'
                      }
                    />
                    <DetailItem
                      label="Tenure"
                      value={
                        application.serviceDetails.tenure
                          ? `${application.serviceDetails.tenure} months`
                          : '—'
                      }
                    />
                    <DetailItem label="Purpose" value={application.serviceDetails.purpose} />
                    <DetailItem label="Lender" value={application.lender} />
                    <DetailItem label="Source" value={application.source} />
                    {application.serviceDetails.insuranceType && (
                      <DetailItem
                        label="Insurance type"
                        value={application.serviceDetails.insuranceType}
                      />
                    )}
                    {application.serviceDetails.cardCategory && (
                      <DetailItem
                        label="Card category"
                        value={application.serviceDetails.cardCategory}
                      />
                    )}
                    {application.serviceDetails.serviceNotes && (
                      <DetailItem
                        label="Advisor notes"
                        value={application.serviceDetails.serviceNotes}
                        className="sm:col-span-2"
                      />
                    )}
                  </dl>
                </section>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <SectionTitle>Processing</SectionTitle>
                  <dl className="space-y-3.5">
                    <DetailItem
                      label="Assigned to"
                      value={
                        <span className="flex items-center justify-between gap-2">
                          {application.assignedTo}
                          {isAdmin && (
                            <Button variant="link" onClick={() => setAssignOpen(true)}>
                              Change
                            </Button>
                          )}
                        </span>
                      }
                    />
                    <DetailItem label="Current stage" value={application.processingStage} />
                    <DetailItem
                      label="Last updated"
                      value={formatDateTime(application.updatedAt)}
                    />
                    <DetailItem
                      label="Admin remarks"
                      value={application.adminRemarks || 'No remarks recorded.'}
                    />
                    <DetailItem
                      label="Lead"
                      value={
                        <Link
                          to={`${base}/leads/${application.id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {application.leadId}
                        </Link>
                      }
                    />
                  </dl>
                </div>

                {isAdmin && advisor && (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <SectionTitle>Advisor</SectionTitle>
                    <div className="flex items-center gap-3">
                      <Avatar name={advisor.name} color={advisor.avatarColor} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {advisor.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {advisor.code} · {advisor.agency}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-[13px]">
                      <p className="flex items-center gap-2 text-slate-600">
                        <Phone className="size-3.5 text-slate-400" />
                        {advisor.mobile}
                      </p>
                      <p className="flex items-center gap-2 truncate text-slate-600">
                        <Mail className="size-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{advisor.email}</span>
                      </p>
                      <p className="flex items-center gap-2 text-slate-600">
                        <Building2 className="size-3.5 text-slate-400" />
                        {advisor.city}
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 p-4">
                  <SectionTitle>Payout</SectionTitle>
                  {payout ? (
                    <dl className="space-y-3.5">
                      <DetailItem
                        label="Payout amount"
                        value={
                          <span className="tnum font-semibold text-money-700">
                            {formatCurrency(payout.payoutAmount)}
                          </span>
                        }
                      />
                      <DetailItem
                        label="Status"
                        value={<PayoutBadge status={payout.status} />}
                      />
                      <DetailItem
                        label="Disbursed on"
                        value={formatDate(payout.disbursementDate)}
                      />
                      <DetailItem label="Paid on" value={formatDate(payout.paymentDate)} />
                      {payout.utr && <DetailItem label="UTR" value={payout.utr} mono />}
                    </dl>
                  ) : (
                    <div className="flex items-start gap-2.5 text-[13px] text-slate-500">
                      <Wallet className="mt-0.5 size-4 shrink-0 text-slate-400" />
                      <p>
                        Estimated payout on disbursal:{' '}
                        <span className="font-medium text-slate-700">
                          {formatCurrency(application.expectedPayout)}
                        </span>{' '}
                        . Final payout depends on the lender and actual disbursed amount.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <SectionTitle>Document completeness</SectionTitle>
                  <ProgressBar
                    value={verified}
                    max={Math.max(1, documents.length)}
                    tone={verified === documents.length ? 'money' : 'brand'}
                    label={<span>{verified} verified</span>}
                  />
                  {missing.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {missing.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between gap-2 text-[13px]"
                        >
                          <span className="truncate text-slate-600">{doc.name}</span>
                          <DocStatusBadge status={doc.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </CardBody>
        )}

        {tab === 'documents' && (
          <CardBody>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-slate-500">
                {verified} of {documents.length} verified
                {missing.length > 0 && ` · ${missing.length} waiting on the advisor`}
              </p>
              {canRequest && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<FilePlus2 className="size-3.5" />}
                  onClick={() => setRequestOpen(true)}
                >
                  Request a document
                </Button>
              )}
            </div>
            {documents.length === 0 ? (
              <EmptyState
                icon={<FileText className="size-5" />}
                title="No documents on this file"
                description="Documents uploaded by the advisor will appear here."
              />
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-3 py-3"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100">
                      <FileTypeIcon fileType={doc.fileType} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-medium text-slate-800">
                        {doc.name}
                        {doc.required && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Required
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {doc.fileName
                          ? `${doc.fileName} · ${formatBytes(doc.size)} · uploaded ${formatDate(doc.uploadedAt)}`
                          : 'Not uploaded yet'}
                      </p>
                      {doc.remarks && (
                        <p className="mt-1 text-xs leading-snug text-amber-700">{doc.remarks}</p>
                      )}
                    </div>

                    <DocStatusBadge status={doc.status} />

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="size-3.5" />}
                        onClick={() => setPreviewing(doc)}
                      >
                        {isAdmin ? 'Review' : 'Preview'}
                      </Button>
                      {!isAdmin && !isStaff && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setReuploadTarget(doc.id);
                            fileInput.current?.click();
                          }}
                        >
                          {doc.fileName ? 'Replace' : 'Upload'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        )}

        {tab === 'timeline' && (
          <CardBody>
            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <div>
                <SectionTitle>Application pipeline</SectionTitle>
                <ApplicationTimeline application={application} />
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <SectionTitle>Key dates</SectionTitle>
                <dl className="space-y-3.5">
                  <DetailItem label="Created" value={formatDateTime(application.createdAt)} />
                  <DetailItem label="Submitted" value={formatDateTime(application.submittedAt)} />
                  <DetailItem label="Last updated" value={formatDateTime(application.updatedAt)} />
                  {payout?.disbursementDate && (
                    <DetailItem
                      label="Disbursed"
                      value={formatDateTime(payout.disbursementDate)}
                    />
                  )}
                  {payout?.paymentDate && (
                    <DetailItem label="Payout paid" value={formatDateTime(payout.paymentDate)} />
                  )}
                </dl>
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <CalendarClock className="size-3.5" />
                  {application.timeline.length} recorded events
                </div>
              </div>
            </div>
          </CardBody>
        )}

        {tab === 'activity' && (
          <CardBody>
            <ActivityLog events={application.timeline} />
          </CardBody>
        )}
      </Card>

      {/* Quick facts footer */}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <FactCard
          icon={<UserRound className="size-4" />}
          label="Sourced by"
          value={application.advisorName}
          hint={advisor?.code ?? ''}
        />
        <FactCard
          icon={<Landmark className="size-4" />}
          label="Lender"
          value={application.lender}
          hint={application.processingStage}
        />
        <FactCard
          icon={<MessageSquare className="size-4" />}
          label="Latest remark"
          value={application.adminRemarks || 'No remarks yet'}
          hint={relativeTime(application.updatedAt)}
        />
      </div>

      <AssignStaffModal
        application={assignOpen ? application : null}
        onClose={() => setAssignOpen(false)}
      />
      <RequestDocumentModal
        application={requestOpen ? application : null}
        onClose={() => setRequestOpen(false)}
      />
      <DocumentPreviewModal
        document={previewing}
        onClose={() => setPreviewing(null)}
        role={user?.role ?? 'advisor'}
        customerName={application.customer.fullName}
      />

      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          handleReupload(e.target.files);
          e.target.value = '';
        }}
      />

      <Modal
        open={statusModal}
        onClose={() => setStatusModal(false)}
        title={`Update status — ${application.id}`}
        description={`${application.customer.fullName} · ${application.service}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitStatusChange} loading={saving} disabled={!nextStatus}>
              Save update
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
            <span className="text-xs text-slate-500">Current</span>
            <StatusBadge status={application.status} />
          </div>
          <Select
            label="New status"
            required
            options={APPLICATION_STATUS_TRANSITIONS[application.status] ?? []}
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as ApplicationStatus)}
          />
          <Textarea
            label="Remarks for the advisor"
            rows={3}
            placeholder="Explain what changed and what the advisor needs to do next…"
            value={statusRemarks}
            onChange={(e) => setStatusRemarks(e.target.value)}
          />
          {['Approved', 'Disbursed', 'Completed'].includes(nextStatus) && (
            <div className="flex items-start gap-2.5 rounded-lg border border-money-500/20 bg-money-50 px-3 py-2.5">
              <Wallet className="mt-0.5 size-4 shrink-0 text-money-700" />
              <p className="text-[13px] leading-snug text-money-700">
                Estimated payout on disbursal: {formatCurrency(application.expectedPayout)} for{' '}
                {application.advisorName}. Approval does not release a payout. The final amount depends on the lender and actual disbursal.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

function SummaryTile({
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

function FactCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="card-surface flex items-start gap-3 px-4 py-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] font-medium text-slate-800">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}
