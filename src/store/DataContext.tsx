import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import type {
  Advisor, AdvisorProfile, AppDocument, AppNotification, Application, ApplicationStatus,
  AuditEntry, CustomerInfo, DocumentStatus, EmploymentInfo, LeadActivity, LeadActivityKind,
  LeadStage, Lender, LenderStatus, Payout, PayoutStatus, ProductConfig, Role, ServiceDetails,
  ServiceType, StaffMember, SupportTicket, TicketCategory, TicketPriority, TicketStatus,
} from '@/types';

export interface DraftApplication { customer: CustomerInfo; employment: EmploymentInfo; serviceDetails: ServiceDetails }
export const EMPTY_CUSTOMER: CustomerInfo = { fullName: '', mobile: '', email: '', dob: '', gender: '', pan: '', aadhaar: '', address: '', city: '', state: '', pincode: '' };
export const EMPTY_EMPLOYMENT: EmploymentInfo = { employmentType: '', monthlyIncome: '', organisation: '', experience: '', designation: '', businessVintage: '', businessType: '', gstin: '', natureOfWork: '', existingLoans: '', existingEmi: '', creditScore: '', bankName: '', accountNumber: '', ifsc: '' };
export const EMPTY_SERVICE_DETAILS: ServiceDetails = { service: '', loanAmount: '', tenure: '', purpose: '', preferredLender: '', cardCategory: '', existingCards: '', insuranceType: '', sumAssured: '', premiumFrequency: '', serviceNotes: '' };

interface UploadDocumentInput extends Omit<AppDocument, 'id' | 'applicationId'> { file?: File }
interface SubmitPayload extends DraftApplication { documents: UploadDocumentInput[]; advisorId: string; advisorName: string }
export interface CreateAdvisorInput {
  name: string;
  email: string;
  mobile: string;
  password: string;
  code: string;
  agency?: string;
  pan?: string;
  gstin?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  pincode?: string;
}
interface NewTicket { advisorId: string; advisorName: string; subject: string; category: TicketCategory; priority: TicketPriority; applicationId: string | null; body: string }
export interface AuditActor { name: string; role: Role | 'System' }

interface DataContextValue {
  applications: Application[]; documents: AppDocument[]; payouts: Payout[]; notifications: AppNotification[];
  advisors: Advisor[]; staff: StaffMember[]; lenders: Lender[]; products: ProductConfig[];
  auditLog: AuditEntry[]; leadActivities: LeadActivity[]; tickets: SupportTicket[]; profile: AdvisorProfile;
  loading: boolean; error: string | null; refresh: () => Promise<void>;
  setAuditActor: (actor: AuditActor) => void;
  submitApplication: (payload: SubmitPayload) => Promise<Application>;
  saveDraft: (payload: DraftApplication) => Promise<string>;
  updateApplicationStatus: (id: string, status: ApplicationStatus, remarks: string, actor?: string) => Promise<void>;
  updateApplicationDetails: (id: string, patch: Partial<Pick<Application, 'customer' | 'employment' | 'serviceDetails' | 'loanAmount' | 'service'>>) => Promise<void>;
  assignApplication: (id: string, staffId: string | null) => Promise<void>;
  updateLeadStage: (id: string, stage: LeadStage, note?: string) => Promise<void>;
  addLeadActivity: (id: string, kind: LeadActivityKind, note: string, actor?: string) => Promise<void>;
  replaceDocument: (id: string, file: { fileName: string; fileType: string; size: number; file?: File }) => Promise<void>;
  setDocumentStatus: (id: string, status: DocumentStatus, remarks?: string) => Promise<void>;
  addDocumentToApplication: (id: string, doc: { name: string; fileName: string; fileType: string; size: number; file?: File }) => Promise<void>;
  requestDocument: (id: string, name: string, remarks: string) => Promise<void>;
  updatePayoutStatus: (id: string, status: PayoutStatus) => Promise<void>;
  setAdvisorStatus: (id: string, status: Advisor['status']) => Promise<void>;
  createAdvisor: (input: CreateAdvisorInput) => Promise<Advisor>;
  saveStaffMember: (member: StaffMember) => Promise<void>; setStaffStatus: (id: string, status: StaffMember['status']) => Promise<void>;
  saveLender: (lender: Lender) => Promise<void>; setLenderStatus: (id: string, status: LenderStatus) => Promise<void>;
  updateProduct: (service: ServiceType, patch: Partial<ProductConfig>) => Promise<void>;
  createTicket: (ticket: NewTicket) => Promise<SupportTicket>;
  replyToTicket: (id: string, body: string, author: string, role: Role) => Promise<void>;
  setTicketStatus: (id: string, status: TicketStatus) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>; markAllNotificationsRead: (audience: Role) => Promise<void>;
  updateProfile: (patch: Partial<AdvisorProfile>) => Promise<void>;
  documentsFor: (id: string) => AppDocument[]; applicationById: (id: string) => Application | undefined;
  payoutFor: (id: string) => Payout | undefined; activitiesFor: (id: string) => LeadActivity[];
  ticketsFor: (id: string) => SupportTicket[]; productFor: (service: ServiceType) => ProductConfig | undefined;
}

type RecordAny = Record<string, any>;
type ListResponse = { data: RecordAny[] };
const DataContext = createContext<DataContextValue | null>(null);

const APP_STATUS_FROM_API: Record<string, ApplicationStatus> = {
  DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review', DOCUMENTS_PENDING: 'Documents Required',
  SENT_TO_LENDER: 'Submitted to Lender', LENDER_PROCESSING: 'Processing', APPROVED: 'Approved', REJECTED: 'Rejected',
  DISBURSED: 'Disbursed', CANCELLED: 'Rejected',
};
const APP_STATUS_TO_API: Partial<Record<ApplicationStatus, string>> = {
  Draft: 'DRAFT', Submitted: 'SUBMITTED', 'Under Review': 'UNDER_REVIEW', 'Documents Required': 'DOCUMENTS_PENDING',
  Processing: 'LENDER_PROCESSING', 'Submitted to Lender': 'SENT_TO_LENDER', 'Additional Information Required': 'DOCUMENTS_PENDING',
  Approved: 'APPROVED', Rejected: 'REJECTED', Disbursed: 'DISBURSED', Completed: 'DISBURSED',
};
const LEAD_STAGE_FROM_API: Record<string, LeadStage> = { NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', DOCUMENTS_PENDING: 'Documents Pending', CONVERTED: 'Converted', DROPPED: 'Dropped' };
const LEAD_STAGE_TO_API = Object.fromEntries(Object.entries(LEAD_STAGE_FROM_API).map(([key, value]) => [value, key]));
const DOC_STATUS_FROM_API: Record<string, DocumentStatus> = { PENDING: 'Pending', UPLOADED: 'Uploaded', UNDER_VERIFICATION: 'Under Verification', VERIFIED: 'Verified', REJECTED: 'Rejected', REUPLOAD_REQUIRED: 'Re-upload Required' };
const TICKET_CATEGORY_TO_API: Record<TicketCategory, string> = { 'Application query': 'APPLICATION_QUERY', 'Document issue': 'DOCUMENT_ISSUE', 'Payout query': 'PAYOUT_QUERY', 'Account & access': 'ACCOUNT_ACCESS', 'Product information': 'PRODUCT_INFORMATION', Other: 'OTHER' };
const TICKET_CATEGORY_FROM_API = Object.fromEntries(Object.entries(TICKET_CATEGORY_TO_API).map(([key, value]) => [value, key]));

const emptyProfile: AdvisorProfile = { name: '', email: '', mobile: '', dsaId: '', agency: '', gstin: '', address: '', city: '', state: '', pincode: '', bankName: '', accountNumber: '', ifsc: '', accountHolder: '', panNumber: '', accountStatus: 'Inactive', photo: null };
const title = (value: string) => value.toLowerCase().split('_').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
const number = (value: unknown) => value == null ? 0 : Number(value);
const customer = (item: RecordAny | null | undefined): CustomerInfo => ({
  fullName: item?.fullName ?? '', mobile: item?.mobile ?? '', email: item?.email ?? '', dob: item?.dateOfBirth?.slice?.(0, 10) ?? '',
  gender: title(item?.gender ?? '') as CustomerInfo['gender'], pan: item?.pan ?? item?.panMasked ?? '', aadhaar: item?.aadhaar ?? item?.aadhaarMasked ?? '',
  address: item?.addressLine ?? '', city: item?.city ?? '', state: item?.state ?? '', pincode: item?.pincode ?? '',
});
const employment = (item: RecordAny | null | undefined): EmploymentInfo => ({
  employmentType: item?.employmentType ?? '', monthlyIncome: String(item?.monthlyIncome ?? ''), organisation: item?.organisation ?? '', experience: item?.experience ?? '', designation: item?.designation ?? '', businessVintage: item?.businessVintage ?? '', businessType: item?.businessType ?? '', gstin: item?.gstin ?? '', natureOfWork: item?.natureOfWork ?? '', existingLoans: item?.existingLoans ?? '', existingEmi: String(item?.existingEmi ?? ''), creditScore: String(item?.creditScore ?? ''), bankName: item?.bankName ?? '', accountNumber: item?.accountNumber ?? item?.bankAccountMasked ?? '', ifsc: item?.ifsc ?? '',
});
const serviceDetails = (item: RecordAny | null | undefined, service = '', amount: unknown = ''): ServiceDetails => ({
  category: item?.category, categoryFields: item?.categoryFields ?? {},
  service: service as ServiceDetails['service'], loanAmount: String(amount ?? ''), tenure: item?.tenure ?? '', purpose: item?.purpose ?? '', preferredLender: item?.preferredLender ?? '', cardCategory: item?.cardCategory ?? '', existingCards: item?.existingCards ?? '', insuranceType: item?.insuranceType ?? '', sumAssured: String(item?.sumAssured ?? ''), premiumFrequency: item?.premiumFrequency ?? '', serviceNotes: item?.serviceNotes ?? '',
});

function mapApplication(item: RecordAny): Application {
  const advisor = item.advisor ?? {};
  const status = APP_STATUS_FROM_API[item.status] ?? 'Submitted';
  return {
    id: item.id, customerId: item.customerId ?? item.customer?.id, leadId: item.leadId ?? item.lead?.id ?? '', advisorId: item.advisorId,
    advisorName: advisor.user?.name ?? advisor.name ?? '', customer: customer(item.customer),
    employment: employment(item.employmentSnapshot ?? item.employmentData),
    serviceDetails: serviceDetails(item.serviceSnapshot ?? item.serviceData, item.serviceType, item.requestedAmount),
    service: item.serviceType as ServiceType, loanAmount: number(item.requestedAmount), status,
    leadStage: item.lead?.stage ? LEAD_STAGE_FROM_API[item.lead.stage] : status === 'Draft' ? 'New' : 'Converted',
    processingStage: status, assignedTo: item.assignedStaff?.user?.name ?? 'Unassigned', assignedStaffId: item.assignedStaff?.id ?? null,
    createdAt: item.createdAt, updatedAt: item.updatedAt, submittedAt: item.submittedAt ?? item.createdAt,
    expectedPayout: number(item.payout?.payoutAmount ?? item.estimatedPayout), adminRemarks: item.remarks?.at?.(-1)?.body ?? '', requiredActions: [],
    timeline: (item.statusHistory ?? []).map((event: RecordAny) => ({ id: event.id, stage: APP_STATUS_FROM_API[event.toStatus] ?? status, label: APP_STATUS_FROM_API[event.toStatus] ?? event.toStatus, note: event.remarks ?? '', actor: event.changedBy?.name ?? 'Cibilon Operations', at: event.createdAt })),
    lender: item.lender?.name ?? item.serviceSnapshot?.preferredLender ?? 'No preference', source: item.lead?.source ?? 'Advisor submission',
  };
}

function mapLead(item: RecordAny): Application {
  const service = (item.serviceType ?? 'Other Financial Services') as ServiceType;
  return {
    id: item.id, leadId: item.id, advisorId: item.advisorId, advisorName: item.advisor?.user?.name ?? '', customer: customer(item.customer),
    employment: employment({ ...(item.employmentData ?? {}), bankAccountMasked: item.bankAccountMasked }),
    serviceDetails: serviceDetails(item.serviceData, service, item.requestedAmount), service, loanAmount: number(item.requestedAmount),
    status: item.status === 'DRAFT' ? 'Draft' : 'Submitted', leadStage: LEAD_STAGE_FROM_API[item.stage] ?? 'New', processingStage: 'Lead pipeline',
    assignedTo: 'Unassigned', assignedStaffId: null, createdAt: item.createdAt, updatedAt: item.updatedAt, submittedAt: null,
    expectedPayout: 0, adminRemarks: item.notes ?? '', requiredActions: [], timeline: [], lender: item.serviceData?.preferredLender ?? 'No preference', source: item.source ?? 'Advisor lead',
  };
}

function mapDocument(item: RecordAny): AppDocument {
  const version = item.document?.latestVersion;
  return { id: item.document?.id ?? item.id, applicationId: item.applicationId, name: item.displayName, fileName: version?.originalName ?? '', fileType: version?.mimeType ?? '', size: version?.sizeBytes ?? 0, uploadedAt: version?.uploadedAt ?? version?.createdAt ?? null, status: DOC_STATUS_FROM_API[item.status] ?? 'Pending', remarks: item.rejectionReason ?? '', required: item.required };
}
function mapPayout(item: RecordAny): Payout {
  return { id: item.id, applicationId: item.applicationId, advisorId: item.advisorId, customerName: item.application?.customer?.fullName ?? '', service: item.application?.serviceType as ServiceType, loanAmount: number(item.disbursedAmount), payoutAmount: number(item.payoutAmount), payoutRate: number(item.percentageRate), estimated: Boolean(item.estimated), disbursementDate: item.estimated ? null : item.application?.disbursedAt ?? null, status: item.status === 'PAID' ? 'Paid' : item.status === 'PROCESSING' ? 'Processing' : 'Pending', paymentDate: item.paidAt ?? null, utr: item.paymentReference ?? null };
}
function mapAdvisor(item: RecordAny): Advisor { return { id: item.id, name: item.user?.name ?? '', code: item.code, email: item.user?.email ?? '', mobile: item.user?.mobile ?? '', agency: item.agency ?? '', city: item.city ?? '', joinedOn: item.createdAt, status: title(item.status) as Advisor['status'], avatarColor: '#0f766e' }; }
function mapStaff(item: RecordAny): StaffMember { return { id: item.id, name: item.user?.name ?? '', code: item.code, email: item.user?.email ?? '', mobile: item.user?.mobile ?? '', role: title(item.role) as StaffMember['role'], department: item.department, status: item.status === 'ACTIVE' ? 'Active' : 'Inactive', joinedOn: item.createdAt, avatarColor: '#4338ca' }; }
function mapLender(item: RecordAny): Lender { return { id: item.id, name: item.name, type: (item.type === 'BANK' ? 'Bank' : title(item.type)) as Lender['type'], status: title(item.status) as LenderStatus, services: (item.services ?? []) as ServiceType[], commission: {}, turnaroundDays: item.turnaroundDays ?? 1, contactPerson: item.contactPerson ?? '', email: item.email ?? '', phone: item.phone ?? '', city: item.city ?? '', empanelledOn: item.createdAt, notes: item.notes ?? '' }; }
function mapProduct(item: RecordAny): ProductConfig { return { id: item.id, service: item.serviceType, active: item.active, tagline: item.tagline ?? '', minAmount: number(item.minAmount), maxAmount: number(item.maxAmount), minTenure: item.minTenureMonths ?? 0, maxTenure: item.maxTenureMonths ?? 0, interestFrom: number(item.interestFrom), interestTo: number(item.interestTo), payoutRate: number(item.defaultCommissionRule?.percentageRate), flatPayout: item.defaultCommissionRule?.calculationType === 'FLAT' ? number(item.defaultCommissionRule.flatAmount) : null, commissionOptions: (item.commissionOptions ?? []).map((rule: RecordAny) => ({ id: rule.id, lenderId: rule.lenderId ?? null, lenderName: rule.lender?.name ?? 'All lenders (default)', calculationType: rule.calculationType, percentageRate: rule.percentageRate == null ? null : number(rule.percentageRate), flatAmount: rule.flatAmount == null ? null : number(rule.flatAmount), effectiveFrom: rule.effectiveFrom })), documents: (item.documents ?? []).map((doc: RecordAny) => ({ name: doc.displayName, required: doc.required })), eligibility: (item.eligibility ?? []).map((rule: RecordAny) => rule.rule), lenderIds: (item.lenders ?? []).filter((entry: RecordAny) => entry.active).map((entry: RecordAny) => entry.lenderId) }; }
function mapTicket(item: RecordAny): SupportTicket { return { id: item.id, advisorId: item.advisorId, advisorName: item.advisor?.user?.name ?? '', subject: item.subject, category: (TICKET_CATEGORY_FROM_API[item.category] ?? 'Other') as TicketCategory, applicationId: item.applicationId, status: title(item.status) as TicketStatus, priority: title(item.priority) as TicketPriority, createdAt: item.createdAt, updatedAt: item.updatedAt, messages: (item.messages ?? []).map((message: RecordAny) => ({ id: message.id, author: message.author?.name ?? '', authorRole: message.author?.email?.endsWith('@cibilon.in') ? 'admin' : 'advisor', body: message.body, at: message.createdAt })) }; }

function leadPayload(input: DraftApplication) {
  const c = input.customer; const e = input.employment; const d = input.serviceDetails;
  const compact = (record: Record<string, unknown>) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== '' && value != null));
  return {
    customer: compact({ fullName: c.fullName, mobile: c.mobile, email: c.email, dateOfBirth: c.dob, gender: c.gender ? c.gender.toUpperCase() : undefined, pan: c.pan, aadhaar: c.aadhaar, addressLine: c.address, city: c.city, state: c.state, pincode: c.pincode }),
    serviceType: d.service || undefined, requestedAmount: d.loanAmount ? Number(d.loanAmount) : undefined,
    employment: compact({ ...e, monthlyIncome: e.monthlyIncome ? Number(e.monthlyIncome) : undefined, existingEmi: e.existingEmi ? Number(e.existingEmi) : undefined, creditScore: e.creditScore || undefined }),
    serviceDetails: compact({ ...d, service: undefined, loanAmount: undefined, sumAssured: d.sumAssured ? Number(d.sumAssured) : undefined }), source: 'Advisor portal',
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]); const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]); const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]); const [staff, setStaff] = useState<StaffMember[]>([]);
  const [lenders, setLenders] = useState<Lender[]>([]); const [products, setProducts] = useState<ProductConfig[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]); const [leadActivities] = useState<LeadActivity[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]); const [profile, setProfile] = useState<AdvisorProfile>(emptyProfile);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      if (user.role === 'staff') {
        const [apps, docs, notes, lenderRows, productRows] = await Promise.all([
          apiRequest<ListResponse>('/applications?pageSize=100'),
          apiRequest<ListResponse>('/documents?pageSize=100'),
          apiRequest<ListResponse>('/notifications?pageSize=100'),
          apiRequest<ListResponse>('/lenders?pageSize=100'),
          apiRequest<ListResponse>('/products?pageSize=100'),
        ]);
        const details = await Promise.all(apps.data.map((app) => apiRequest<{ data: RecordAny }>(`/applications/${app.id}`).then((r) => r.data)));
        setApplications(details.map(mapApplication)); setDocuments(docs.data.map(mapDocument));
        setLenders(lenderRows.data.map(mapLender)); setProducts(productRows.data.map(mapProduct));
        setNotifications(notes.data.filter((note) => !note.applicationId || apps.data.some((app) => app.id === note.applicationId)).map((note) => ({ id: note.id, kind: 'status', title: note.title, body: note.body, applicationId: note.applicationId ?? undefined, audience: 'staff', at: note.createdAt, read: note.isRead })));
        setAdvisors([]); setStaff([]); setPayouts([]); setAuditLog([]); setTickets([]);
        setProfile({ ...emptyProfile, name: user.name, email: user.email, mobile: user.mobile });
        return;
      }
      const requests = [
        apiRequest<ListResponse>('/applications?pageSize=100'), apiRequest<ListResponse>('/leads?pageSize=100'),
        apiRequest<ListResponse>('/documents?pageSize=100'), apiRequest<ListResponse>('/payouts?pageSize=100'),
        apiRequest<ListResponse>('/notifications?pageSize=100'), apiRequest<ListResponse>('/lenders?pageSize=100'),
        apiRequest<ListResponse>('/products?pageSize=100'), apiRequest<ListResponse>('/support/tickets?pageSize=100'),
      ];
      const results = await Promise.all(requests);
      const [apps, leads, docs, pays, notes, lenderRows, productRows, ticketRows] = results;
      const detailedApps = await Promise.all(apps.data.map((app) => apiRequest<{ data: RecordAny }>(`/applications/${app.id}`).then((r) => r.data).catch(() => app)));
      const ticketDetails = await Promise.all(ticketRows.data.map((ticket) => apiRequest<{ data: RecordAny }>(`/support/tickets/${ticket.id}`).then((r) => r.data).catch(() => ticket)));
      setApplications([...detailedApps.map(mapApplication), ...leads.data.filter((lead) => !lead.application).map(mapLead)]);
      setDocuments(docs.data.map(mapDocument)); setPayouts(pays.data.map(mapPayout));
      setNotifications(notes.data.map((note) => ({ id: note.id, kind: note.type === 'PAYOUT_ACTION' ? 'payout' : note.type === 'DOCUMENT_ACTION' ? 'document' : note.type === 'STATUS_CHANGED' ? 'status' : 'alert', title: note.title, body: note.body, applicationId: note.applicationId ?? undefined, audience: user.role, at: note.createdAt, read: note.isRead })));
      const mappedProducts = productRows.data.map(mapProduct);
      setLenders(lenderRows.data.map((row) => ({ ...mapLender(row), services: mappedProducts.filter((product) => product.lenderIds.includes(row.id)).map((product) => product.service) })));
      setProducts(mappedProducts); setTickets(ticketDetails.map(mapTicket));

      if (user.role === 'admin') {
        const [advisorRows, staffRows, auditRows] = await Promise.all([apiRequest<ListResponse>('/advisors?pageSize=100'), apiRequest<ListResponse>('/staff?pageSize=100'), apiRequest<ListResponse>('/audit-logs?pageSize=100')]);
        setAdvisors(advisorRows.data.map(mapAdvisor)); setStaff(staffRows.data.map(mapStaff));
        setAuditLog(auditRows.data.map((entry) => ({ id: entry.id, at: entry.createdAt, actorName: entry.actor?.name ?? 'System', actorRole: entry.actor?.advisorProfile ? 'advisor' : entry.actor ? 'admin' : 'System', action: entry.action, module: title(entry.entityType) as AuditEntry['module'], entityId: entry.entityId, details: JSON.stringify(entry.metadata ?? {}), ip: entry.ipAddress ?? '—' })));
        setProfile({ ...emptyProfile, name: user.name, email: user.email, mobile: user.mobile, dsaId: user.code, accountStatus: 'Active' });
      } else {
        const own = await apiRequest<{ data: RecordAny }>('/advisors/me'); const item = own.data; setAdvisors([mapAdvisor(item)]);
        setProfile({ name: item.user.name, email: item.user.email, mobile: item.user.mobile, dsaId: item.code, agency: item.agency ?? '', gstin: item.gstin ?? '', address: item.addressLine ?? '', city: item.city ?? '', state: item.state ?? '', pincode: item.pincode ?? '', bankName: item.bankAccount?.bankName ?? '', accountNumber: item.bankAccount?.accountNumberMasked ?? '', ifsc: item.bankAccount?.ifsc ?? '', accountHolder: item.bankAccount?.accountHolder ?? '', panNumber: item.panMasked ?? '', accountStatus: item.status === 'ACTIVE' ? 'Active' : 'Inactive', photo: item.photoUrl ?? null });
      }
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { if (user) void refresh(); else { setApplications([]); setDocuments([]); setPayouts([]); setNotifications([]); } }, [user, refresh]);
  const mutate = useCallback(async (work: () => Promise<unknown>) => { setError(null); try { await work(); await refresh(); } catch (requestError) { const message = errorMessage(requestError); setError(message); throw requestError; } }, [refresh]);
  const setAuditActor = useCallback((_actor: AuditActor) => undefined, []);

  const saveDraft = useCallback(async (payload: DraftApplication) => { const response = await apiRequest<{ data: RecordAny }>('/leads/drafts', { method: 'POST', body: leadPayload(payload) }); await refresh(); return response.data.id as string; }, [refresh]);
  const submitApplication = useCallback(async (payload: SubmitPayload) => {
    const lead = await apiRequest<{ data: RecordAny }>('/leads', { method: 'POST', body: leadPayload(payload) });
    const converted = await apiRequest<{ data: RecordAny }>(`/leads/${lead.data.id}/convert`, { method: 'POST', body: { remarks: 'Submitted from advisor portal' } });
    const applicationId = converted.data.id as string;
    const requests = await apiRequest<ListResponse>(`/applications/${applicationId}/documents?pageSize=100`);
    for (const upload of payload.documents.filter((doc) => doc.file)) {
      const request = requests.data.find((item) => item.displayName === upload.name);
      if (!request) continue;
      const form = new FormData(); form.append('documentRequestId', request.id); form.append('file', upload.file!);
      await apiRequest(`/applications/${applicationId}/documents`, { method: 'POST', form });
    }
    await refresh(); return mapApplication(converted.data);
  }, [refresh]);

  const updateApplicationStatus = useCallback(async (id: string, status: ApplicationStatus, remarks: string) => mutate(async () => { const apiStatus = APP_STATUS_TO_API[status]; if (!apiStatus) throw new Error(`Unsupported status: ${status}`); const app = applications.find((item) => item.id === id); const product = products.find((item) => item.service === app?.service); const lender = lenders.find((item) => item.name === app?.lender) ?? lenders.find((item) => product?.lenderIds.includes(item.id)); if ((apiStatus === 'APPROVED' || apiStatus === 'DISBURSED') && !lender) throw new Error('Select or configure an active lender before approval.'); await apiRequest(`/applications/${id}/status`, { method: 'PATCH', body: { status: apiStatus, remarks, ...(['APPROVED', 'DISBURSED'].includes(apiStatus) ? { lenderId: lender?.id } : {}), ...(apiStatus === 'DISBURSED' ? { disbursedAmount: app?.loanAmount ?? 0 } : {}) } }); }), [applications, lenders, mutate, products]);
  const updateApplicationDetails = useCallback(async (id: string, patch: Partial<Application>) => mutate(async () => { const app = applications.find((item) => item.id === id); if (!app?.leadId) throw new Error('The source lead is not available'); await apiRequest(`/leads/${app.leadId}`, { method: 'PATCH', body: leadPayload({ customer: patch.customer ?? app.customer, employment: patch.employment ?? app.employment, serviceDetails: patch.serviceDetails ?? app.serviceDetails }) }); }), [applications, mutate]);
  const assignApplication = useCallback(async (id: string, staffId: string | null) => mutate(() => apiRequest(`/applications/${id}/assignment`, { method: 'PUT', body: { staffId, note: staffId ? 'Assigned from admin console' : 'Unassigned from admin console' } })), [mutate]);
  const updateLeadStage = useCallback(async (id: string, stage: LeadStage, note = '') => mutate(async () => { const app = applications.find((item) => item.id === id); const leadId = app?.leadId || id; await apiRequest(`/leads/${leadId}`, { method: 'PATCH', body: { stage: LEAD_STAGE_TO_API[stage], ...(note ? { notes: note } : {}) } }); }), [applications, mutate]);
  const addLeadActivity = useCallback(async (id: string, kind: LeadActivityKind, note: string) => mutate(async () => { const app = applications.find((item) => item.id === id); const apiKind = ['Call', 'Meeting', 'Email', 'Note'].includes(kind) ? kind.toUpperCase() : 'NOTE'; await apiRequest(`/leads/${app?.leadId || id}/activities`, { method: 'POST', body: { kind: apiKind, note } }); }), [applications, mutate]);

  const replaceDocument = useCallback(async (id: string, file: { file?: File }) => mutate(async () => { if (!file.file) throw new Error('Select the source file again to upload it'); const form = new FormData(); form.append('file', file.file); await apiRequest(`/documents/${id}/versions`, { method: 'POST', form }); }), [mutate]);
  const setDocumentStatus = useCallback(async (id: string, status: DocumentStatus, remarks = '') => mutate(() => apiRequest(`/documents/${id}/status`, { method: 'PATCH', body: { status: status === 'Verified' ? 'VERIFIED' : 'REJECTED', ...(status === 'Verified' ? {} : { reason: remarks || 'Please upload a new copy.' }) } })), [mutate]);
  const requestDocument = useCallback(async (id: string, name: string, remarks: string) => mutate(() => apiRequest(`/applications/${id}/document-requests`, { method: 'POST', body: { documentType: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), displayName: name, required: true, remarks: remarks || undefined } })), [mutate]);
  const addDocumentToApplication = useCallback(async (id: string, doc: { name: string; file?: File }) => mutate(async () => { if (!doc.file) throw new Error('Select the source file again to upload it'); const request = await apiRequest<{ data: RecordAny }>(`/applications/${id}/document-requests`, { method: 'POST', body: { documentType: doc.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), displayName: doc.name, required: false } }); const form = new FormData(); form.append('documentRequestId', request.data.id); form.append('file', doc.file); await apiRequest(`/applications/${id}/documents`, { method: 'POST', form }); }), [mutate]);
  const updatePayoutStatus = useCallback(async (id: string, status: PayoutStatus) => mutate(() => apiRequest(`/payouts/${id}/status`, { method: 'PATCH', body: { status: status.toUpperCase(), ...(status === 'Paid' ? { paymentReference: `UI-${Date.now()}`, paymentMethod: 'BANK_TRANSFER' } : {}), note: 'Updated from admin console' } })), [mutate]);
  const setAdvisorStatus = useCallback(async (id: string, status: Advisor['status']) => mutate(() => apiRequest(`/advisors/${id}/status`, { method: 'PATCH', body: { status: status.toUpperCase(), reason: 'Updated from admin console' } })), [mutate]);
  const createAdvisor = useCallback(async (input: CreateAdvisorInput) => {
    const response = await apiRequest<{ data: RecordAny }>('/advisors', {
      method: 'POST',
      body: Object.fromEntries(Object.entries(input).filter(([, value]) => value !== '')),
    });
    await refresh();
    return mapAdvisor(response.data);
  }, [refresh]);
  const saveStaffMember = useCallback(async (member: StaffMember) => mutate(() => { const exists = staff.some((item) => item.id === member.id); return apiRequest(exists ? `/staff/${member.id}` : '/staff', { method: exists ? 'PATCH' : 'POST', body: { name: member.name, email: member.email, mobile: member.mobile, code: member.code, department: member.department, role: member.role.toUpperCase().replaceAll(' ', '_'), ...(!exists ? { password: member.initialPassword, permissionCodes: [] } : {}) } }); }), [mutate, staff]);
  const setStaffStatus = useCallback(async (id: string, status: StaffMember['status']) => mutate(() => apiRequest(`/staff/${id}/status`, { method: 'PATCH', body: { status: status.toUpperCase(), reason: 'Updated from admin console' } })), [mutate]);
  const saveLender = useCallback(async (lender: Lender) => mutate(async () => {
    const exists = lenders.some((item) => item.id === lender.id);
    const response = await apiRequest<{ data: RecordAny }>(exists ? `/lenders/${lender.id}` : '/lenders', {
      method: exists ? 'PATCH' : 'POST',
      body: { name: lender.name, type: lender.type.toUpperCase(), status: lender.status.toUpperCase(), turnaroundDays: lender.turnaroundDays, contactPerson: lender.contactPerson || null, email: lender.email || null, phone: lender.phone || null, city: lender.city || null, notes: lender.notes || null },
    });
    const lenderId = response.data.id as string;
    for (const product of products.filter((item) => item.id)) {
      const mapped = product.lenderIds.filter((id) => id !== lenderId);
      if (lender.services.includes(product.service)) mapped.push(lenderId);
      await apiRequest(`/products/${product.id}/lenders`, { method: 'PUT', body: { mappings: mapped.map((id) => ({ lenderId: id, active: true })) } });
      const rate = lender.commission[product.service];
      if (rate !== undefined && lender.services.includes(product.service)) {
        await apiRequest(`/products/${product.id}/commission-rules`, { method: 'POST', body: { lenderId, calculationType: 'PERCENTAGE', percentageRate: rate, effectiveFrom: new Date().toISOString() } });
      }
    }
  }), [lenders, mutate, products]);
  const setLenderStatus = useCallback(async (id: string, status: LenderStatus) => mutate(() => apiRequest(`/lenders/${id}`, { method: 'PATCH', body: { status: status.toUpperCase() } })), [mutate]);
  const updateProduct = useCallback(async (service: ServiceType, patch: Partial<ProductConfig>) => mutate(async () => { const product = products.find((item) => item.service === service); if (!product?.id) throw new Error('Product not found'); await apiRequest(`/products/${product.id}`, { method: 'PATCH', body: { active: patch.active, tagline: patch.tagline, minAmount: patch.minAmount, maxAmount: patch.maxAmount, minTenureMonths: patch.minTenure, maxTenureMonths: patch.maxTenure, interestFrom: patch.interestFrom, interestTo: patch.interestTo, eligibility: patch.eligibility, documents: patch.documents?.map((doc) => ({ documentType: doc.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), displayName: doc.name, required: doc.required })) } }); if (patch.payoutRate !== undefined || patch.flatPayout !== undefined) await apiRequest(`/products/${product.id}/commission-rules`, { method: 'POST', body: { calculationType: patch.flatPayout != null ? 'FLAT' : 'PERCENTAGE', ...(patch.flatPayout != null ? { flatAmount: patch.flatPayout } : { percentageRate: patch.payoutRate ?? product.payoutRate }), effectiveFrom: new Date().toISOString() } }); }), [mutate, products]);

  const createTicket = useCallback(async (input: NewTicket) => { const response = await apiRequest<{ data: RecordAny }>('/support/tickets', { method: 'POST', body: { subject: input.subject, category: TICKET_CATEGORY_TO_API[input.category], priority: input.priority.toUpperCase(), applicationId: input.applicationId, message: input.body } }); await refresh(); return mapTicket(response.data); }, [refresh]);
  const replyToTicket = useCallback(async (id: string, body: string) => mutate(() => apiRequest(`/support/tickets/${id}/messages`, { method: 'POST', body: { body, internal: false } })), [mutate]);
  const setTicketStatus = useCallback(async (id: string, status: TicketStatus) => mutate(() => apiRequest(`/support/tickets/${id}`, { method: 'PATCH', body: { status: status.toUpperCase().replace(' ', '_'), ...(['Resolved', 'Closed'].includes(status) ? { note: `Ticket ${status.toLowerCase()} from support console` } : {}) } })), [mutate]);
  const markNotificationRead = useCallback(async (id: string) => { setNotifications((prev) => prev.map((item) => item.id === id ? { ...item, read: true } : item)); await apiRequest(`/notifications/${id}`, { method: 'PATCH', body: { isRead: true } }); }, []);
  const markAllNotificationsRead = useCallback(async (_audience: Role) => { setNotifications((prev) => prev.map((item) => ({ ...item, read: true }))); await apiRequest('/notifications/read-all', { method: 'PATCH' }); }, []);
  const updateProfile = useCallback(async (patch: Partial<AdvisorProfile>) => mutate(async () => { const next = { ...profile, ...patch }; await apiRequest('/advisors/me', { method: 'PATCH', body: { name: next.name, email: next.email, mobile: next.mobile, agency: next.agency || null, gstin: next.gstin || null, addressLine: next.address || null, city: next.city || null, state: next.state || null, pincode: next.pincode || null, ...(next.photo?.startsWith('http') ? { photoUrl: next.photo } : next.photo === null ? { photoUrl: null } : {}) } }); if (next.accountNumber && !next.accountNumber.includes('•')) await apiRequest('/advisors/me/bank-account', { method: 'PUT', body: { accountHolder: next.accountHolder, bankName: next.bankName, accountNumber: next.accountNumber, ifsc: next.ifsc } }); }), [mutate, profile]);

  const documentsFor = useCallback((id: string) => documents.filter((item) => item.applicationId === id), [documents]);
  const applicationById = useCallback((id: string) => applications.find((item) => item.id === id), [applications]);
  const payoutFor = useCallback((id: string) => payouts.find((item) => item.applicationId === id), [payouts]);
  const activitiesFor = useCallback((id: string) => leadActivities.filter((item) => item.applicationId === id), [leadActivities]);
  const ticketsFor = useCallback((id: string) => tickets.filter((item) => item.advisorId === id), [tickets]);
  const productFor = useCallback((service: ServiceType) => products.find((item) => item.service === service), [products]);

  const value = useMemo<DataContextValue>(() => ({ applications, documents, payouts, notifications, advisors, staff, lenders, products, auditLog, leadActivities, tickets, profile, loading, error, refresh, setAuditActor, submitApplication, saveDraft, updateApplicationStatus, updateApplicationDetails, assignApplication, updateLeadStage, addLeadActivity, replaceDocument, setDocumentStatus, addDocumentToApplication, requestDocument, updatePayoutStatus, setAdvisorStatus, createAdvisor, saveStaffMember, setStaffStatus, saveLender, setLenderStatus, updateProduct, createTicket, replyToTicket, setTicketStatus, markNotificationRead, markAllNotificationsRead, updateProfile, documentsFor, applicationById, payoutFor, activitiesFor, ticketsFor, productFor }), [applications, documents, payouts, notifications, advisors, staff, lenders, products, auditLog, leadActivities, tickets, profile, loading, error, refresh, setAuditActor, submitApplication, saveDraft, updateApplicationStatus, updateApplicationDetails, assignApplication, updateLeadStage, addLeadActivity, replaceDocument, setDocumentStatus, addDocumentToApplication, requestDocument, updatePayoutStatus, setAdvisorStatus, createAdvisor, saveStaffMember, setStaffStatus, saveLender, setLenderStatus, updateProduct, createTicket, replyToTicket, setTicketStatus, markNotificationRead, markAllNotificationsRead, updateProfile, documentsFor, applicationById, payoutFor, activitiesFor, ticketsFor, productFor]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue { const ctx = useContext(DataContext); if (!ctx) throw new Error('useData must be used inside <DataProvider>'); return ctx; }
