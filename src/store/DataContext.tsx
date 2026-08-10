import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ADVISORS,
  DEFAULT_ADVISOR_PROFILE,
  SEED_APPLICATIONS,
  SEED_DOCUMENTS,
  SEED_NOTIFICATIONS,
  SEED_PAYOUTS,
  computePayout,
  leadStageFor,
} from '@/data/mockData';
import { SEED_AUDIT } from '@/data/audit';
import { SEED_LENDERS } from '@/data/lenders';
import { SEED_PRODUCTS } from '@/data/products';
import { SEED_LEAD_ACTIVITIES, SEED_TICKETS } from '@/data/support';
import { STAFF_MEMBERS } from '@/data/team';
import { DOCUMENT_CHECKLIST, PIPELINE_LABELS } from '@/lib/constants';
import { nowIso, uid } from '@/lib/utils';
import type {
  Advisor,
  AdvisorProfile,
  AppDocument,
  AppNotification,
  Application,
  ApplicationStatus,
  AuditEntry,
  AuditModule,
  CustomerInfo,
  DocumentStatus,
  EmploymentInfo,
  LeadActivity,
  LeadActivityKind,
  LeadStage,
  Lender,
  LenderStatus,
  Payout,
  PayoutStatus,
  ProductConfig,
  Role,
  ServiceDetails,
  ServiceType,
  StaffMember,
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@/types';

export interface DraftApplication {
  customer: CustomerInfo;
  employment: EmploymentInfo;
  serviceDetails: ServiceDetails;
}

export const EMPTY_CUSTOMER: CustomerInfo = {
  fullName: '',
  mobile: '',
  email: '',
  dob: '',
  gender: '',
  pan: '',
  aadhaar: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
};

export const EMPTY_EMPLOYMENT: EmploymentInfo = {
  employmentType: '',
  monthlyIncome: '',
  organisation: '',
  experience: '',
  designation: '',
  businessVintage: '',
  businessType: '',
  gstin: '',
  natureOfWork: '',
  existingLoans: '',
  existingEmi: '',
  creditScore: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
};

export const EMPTY_SERVICE_DETAILS: ServiceDetails = {
  service: '',
  loanAmount: '',
  tenure: '',
  purpose: '',
  preferredLender: '',
  cardCategory: '',
  existingCards: '',
  insuranceType: '',
  sumAssured: '',
  premiumFrequency: '',
  serviceNotes: '',
};

interface SubmitPayload extends DraftApplication {
  documents: Omit<AppDocument, 'id' | 'applicationId'>[];
  advisorId: string;
  advisorName: string;
}

/** Who the audit trail attributes the next mutation to. */
export interface AuditActor {
  name: string;
  role: Role | 'System';
}

interface NewTicket {
  advisorId: string;
  advisorName: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  applicationId: string | null;
  body: string;
}

interface DataContextValue {
  applications: Application[];
  documents: AppDocument[];
  payouts: Payout[];
  notifications: AppNotification[];
  advisors: Advisor[];
  staff: StaffMember[];
  lenders: Lender[];
  products: ProductConfig[];
  auditLog: AuditEntry[];
  leadActivities: LeadActivity[];
  tickets: SupportTicket[];
  profile: AdvisorProfile;

  /** Set once per session so every mutation is attributed correctly. */
  setAuditActor: (actor: AuditActor) => void;

  submitApplication: (payload: SubmitPayload) => Application;
  updateApplicationStatus: (
    applicationId: string,
    status: ApplicationStatus,
    remarks: string,
    actor?: string,
  ) => void;
  updateApplicationDetails: (
    applicationId: string,
    patch: Partial<Pick<Application, 'customer' | 'employment' | 'serviceDetails' | 'loanAmount' | 'service'>>,
  ) => void;
  assignApplication: (applicationId: string, staffId: string | null) => void;
  updateLeadStage: (applicationId: string, stage: LeadStage, note?: string) => void;
  addLeadActivity: (applicationId: string, kind: LeadActivityKind, note: string, actor?: string) => void;

  replaceDocument: (
    documentId: string,
    file: { fileName: string; fileType: string; size: number },
  ) => void;
  setDocumentStatus: (documentId: string, status: DocumentStatus, remarks?: string) => void;
  addDocumentToApplication: (
    applicationId: string,
    doc: { name: string; fileName: string; fileType: string; size: number },
  ) => void;
  requestDocument: (applicationId: string, name: string, remarks: string) => void;

  updatePayoutStatus: (payoutId: string, status: PayoutStatus) => void;

  setAdvisorStatus: (advisorId: string, status: Advisor['status']) => void;
  saveStaffMember: (member: StaffMember) => void;
  setStaffStatus: (staffId: string, status: StaffMember['status']) => void;
  saveLender: (lender: Lender) => void;
  setLenderStatus: (lenderId: string, status: LenderStatus) => void;
  updateProduct: (service: ServiceType, patch: Partial<ProductConfig>) => void;

  createTicket: (ticket: NewTicket) => SupportTicket;
  replyToTicket: (ticketId: string, body: string, author: string, role: Role) => void;
  setTicketStatus: (ticketId: string, status: TicketStatus) => void;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (audience: Role) => void;
  clearNotifications: (audience: Role) => void;
  updateProfile: (patch: Partial<AdvisorProfile>) => void;

  documentsFor: (applicationId: string) => AppDocument[];
  applicationById: (id: string) => Application | undefined;
  payoutFor: (applicationId: string) => Payout | undefined;
  activitiesFor: (applicationId: string) => LeadActivity[];
  ticketsFor: (advisorId: string) => SupportTicket[];
  productFor: (service: ServiceType) => ProductConfig | undefined;
}

const DataContext = createContext<DataContextValue | null>(null);

/** Statuses that should mint a payout row when reached. */
const PAYOUT_TRIGGER: ApplicationStatus[] = ['Disbursed', 'Completed'];

export function DataProvider({ children }: { children: ReactNode }) {
  const [applications, setApplications] = useState<Application[]>(SEED_APPLICATIONS);
  const [documents, setDocuments] = useState<AppDocument[]>(SEED_DOCUMENTS);
  const [payouts, setPayouts] = useState<Payout[]>(SEED_PAYOUTS);
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);
  const [advisors, setAdvisors] = useState<Advisor[]>(ADVISORS);
  const [staff, setStaff] = useState<StaffMember[]>(STAFF_MEMBERS);
  const [lenders, setLenders] = useState<Lender[]>(SEED_LENDERS);
  const [products, setProducts] = useState<ProductConfig[]>(SEED_PRODUCTS);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(SEED_AUDIT);
  const [leadActivities, setLeadActivities] = useState<LeadActivity[]>(SEED_LEAD_ACTIVITIES);
  const [tickets, setTickets] = useState<SupportTicket[]>(SEED_TICKETS);
  const [profile, setProfile] = useState<AdvisorProfile>(DEFAULT_ADVISOR_PROFILE);
  const [sequence, setSequence] = useState(1065);
  const [actor, setActor] = useState<AuditActor>({ name: 'System', role: 'System' });

  const setAuditActor = useCallback((next: AuditActor) => {
    setActor((prev) => (prev.name === next.name && prev.role === next.role ? prev : next));
  }, []);

  const pushAudit = useCallback(
    (action: string, module: AuditModule, entityId: string | null, details: string) => {
      setAuditLog((prev) => [
        {
          id: uid('AL'),
          at: nowIso(),
          actorName: actor.name,
          actorRole: actor.role,
          action,
          module,
          entityId,
          details,
          ip: actor.role === 'System' ? '—' : '103.21.244.18',
        },
        ...prev,
      ]);
    },
    [actor],
  );

  const pushNotification = useCallback(
    (notification: Omit<AppNotification, 'id' | 'at' | 'read'>) => {
      setNotifications((prev) => [
        { ...notification, id: uid('NT'), at: nowIso(), read: false },
        ...prev,
      ]);
    },
    [],
  );

  const pushActivity = useCallback(
    (applicationId: string, kind: LeadActivityKind, note: string, who?: string) => {
      setLeadActivities((prev) => [
        {
          id: uid('LA'),
          applicationId,
          kind,
          note,
          actor: who ?? actor.name,
          at: nowIso(),
        },
        ...prev,
      ]);
    },
    [actor],
  );

  /* ---------------------------------------------------------------- */
  /* Applications & leads                                              */
  /* ---------------------------------------------------------------- */

  const submitApplication = useCallback(
    (payload: SubmitPayload): Application => {
      const id = `APP${sequence}`;
      setSequence((n) => n + 1);

      const service = (payload.serviceDetails.service || 'Other Financial Services') as ServiceType;
      const amount = Number(payload.serviceDetails.loanAmount || 0);
      const at = nowIso();

      const application: Application = {
        id,
        leadId: `LD-${sequence}`,
        advisorId: payload.advisorId,
        advisorName: payload.advisorName,
        customer: payload.customer,
        employment: payload.employment,
        serviceDetails: payload.serviceDetails,
        service,
        loanAmount: amount,
        status: 'Submitted',
        leadStage: leadStageFor('Submitted'),
        processingStage: 'Verification desk',
        assignedTo: 'Unassigned',
        assignedStaffId: null,
        createdAt: at,
        updatedAt: at,
        submittedAt: at,
        expectedPayout: computePayout(service, amount),
        adminRemarks: '',
        requiredActions: [],
        lender: payload.serviceDetails.preferredLender || 'No preference',
        source: 'Advisor submission',
        timeline: [
          {
            id: uid('TL'),
            stage: 'Submitted',
            label: PIPELINE_LABELS.Submitted,
            note: 'Application received from advisor and queued for the verification desk.',
            actor: payload.advisorName,
            at,
          },
        ],
      };

      // Any checklist item the advisor skipped is carried over as "Pending" so
      // the documents page still shows the gap.
      const uploadedNames = new Set(payload.documents.map((d) => d.name));
      const checklist = DOCUMENT_CHECKLIST[service] ?? [];
      const pending: AppDocument[] = checklist
        .filter((entry) => !uploadedNames.has(entry.name))
        .map((entry) => ({
          id: uid('DOC'),
          applicationId: id,
          name: entry.name,
          fileName: '',
          fileType: '',
          size: 0,
          uploadedAt: null,
          status: 'Pending' as DocumentStatus,
          remarks: '',
          required: entry.required,
        }));

      const uploaded: AppDocument[] = payload.documents.map((doc) => ({
        ...doc,
        id: uid('DOC'),
        applicationId: id,
      }));

      setApplications((prev) => [application, ...prev]);
      setDocuments((prev) => [...uploaded, ...pending, ...prev]);
      pushActivity(id, 'Stage', `Lead created and submitted as ${id}.`, payload.advisorName);
      pushAudit(
        'Submitted application',
        'Applications',
        id,
        `${service} for ${payload.customer.fullName}`,
      );
      pushNotification({
        kind: 'status',
        title: `${id} submitted successfully`,
        body: `${payload.customer.fullName}'s ${service.toLowerCase()} application is now with the verification desk.`,
        applicationId: id,
        audience: 'advisor',
      });
      pushNotification({
        kind: 'alert',
        title: `New application ${id} received`,
        body: `${payload.advisorName} submitted a ${service.toLowerCase()} file for ${payload.customer.fullName}.`,
        applicationId: id,
        audience: 'admin',
      });

      return application;
    },
    [pushActivity, pushAudit, pushNotification, sequence],
  );

  const updateApplicationStatus = useCallback(
    (applicationId: string, status: ApplicationStatus, remarks: string, who = 'Cibilon Operations') => {
      const at = nowIso();
      let snapshot: Application | undefined;
      let previous: ApplicationStatus | undefined;

      setApplications((prev) =>
        prev.map((app) => {
          if (app.id !== applicationId) return app;
          previous = app.status;
          const next: Application = {
            ...app,
            status,
            leadStage: leadStageFor(status),
            adminRemarks: remarks || app.adminRemarks,
            updatedAt: at,
            processingStage: PAYOUT_TRIGGER.includes(status)
              ? 'Closed'
              : status === 'Rejected'
                ? 'Closed'
                : app.processingStage,
            timeline: [
              ...app.timeline,
              {
                id: uid('TL'),
                stage: status,
                label: PIPELINE_LABELS[status] ?? status,
                note: remarks,
                actor: who,
                at,
              },
            ],
          };
          snapshot = next;
          return next;
        }),
      );

      if (snapshot && PAYOUT_TRIGGER.includes(status)) {
        const app = snapshot;
        setPayouts((prev) => {
          const existing = prev.find((p) => p.applicationId === applicationId);
          if (existing) {
            return prev.map((p) =>
              p.applicationId === applicationId
                ? {
                    ...p,
                    status: status === 'Completed' ? 'Paid' : p.status,
                    paymentDate: status === 'Completed' ? at : p.paymentDate,
                  }
                : p,
            );
          }
          return [
            {
              id: uid('PO'),
              applicationId,
              advisorId: app.advisorId,
              customerName: app.customer.fullName,
              service: app.service,
              loanAmount: app.loanAmount,
              payoutAmount: app.expectedPayout,
              payoutRate: app.loanAmount ? (app.expectedPayout / app.loanAmount) * 100 : 0,
              disbursementDate: at,
              status: 'Pending',
              paymentDate: null,
              utr: null,
            },
            ...prev,
          ];
        });
      }

      pushAudit(
        'Updated application status',
        'Applications',
        applicationId,
        `${previous ?? '—'} → ${status}${remarks ? ` · ${remarks}` : ''}`,
      );
      pushActivity(applicationId, 'Stage', `Status changed to ${status}.`, who);

      pushNotification({
        kind:
          status === 'Documents Required' || status === 'Additional Information Required'
            ? 'document'
            : status === 'Approved'
              ? 'approval'
              : PAYOUT_TRIGGER.includes(status)
                ? 'payout'
                : 'status',
        title: `${applicationId} is now ${status}`,
        body: remarks || `The application status was updated to ${status}.`,
        applicationId,
        audience: 'advisor',
      });
    },
    [pushActivity, pushAudit, pushNotification],
  );

  const updateApplicationDetails = useCallback<DataContextValue['updateApplicationDetails']>(
    (applicationId, patch) => {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId ? { ...app, ...patch, updatedAt: nowIso() } : app,
        ),
      );
    },
    [],
  );

  const assignApplication = useCallback<DataContextValue['assignApplication']>(
    (applicationId, staffId) => {
      const member = staff.find((s) => s.id === staffId);
      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId
            ? {
                ...app,
                assignedStaffId: member?.id ?? null,
                assignedTo: member?.name ?? 'Unassigned',
                processingStage:
                  app.processingStage === 'Not started' && member
                    ? 'Verification desk'
                    : app.processingStage,
                updatedAt: nowIso(),
              }
            : app,
        ),
      );
      pushAudit(
        member ? 'Assigned application' : 'Unassigned application',
        'Applications',
        applicationId,
        member ? `Assigned to ${member.name} (${member.role})` : 'Owner cleared',
      );
      pushActivity(
        applicationId,
        'Assignment',
        member ? `Assigned to ${member.name} (${member.role}).` : 'Assignment cleared.',
      );
    },
    [pushActivity, pushAudit, staff],
  );

  const updateLeadStage = useCallback<DataContextValue['updateLeadStage']>(
    (applicationId, stage, note = '') => {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId ? { ...app, leadStage: stage, updatedAt: nowIso() } : app,
        ),
      );
      pushAudit('Updated lead stage', 'Leads', applicationId, `Stage set to ${stage}${note ? ` · ${note}` : ''}`);
      pushActivity(applicationId, 'Stage', note || `Lead stage set to ${stage}.`);
    },
    [pushActivity, pushAudit],
  );

  const addLeadActivity = useCallback<DataContextValue['addLeadActivity']>(
    (applicationId, kind, note, who) => {
      pushActivity(applicationId, kind, note, who);
      pushAudit('Logged lead activity', 'Leads', applicationId, `${kind}: ${note}`);
    },
    [pushActivity, pushAudit],
  );

  /* ---------------------------------------------------------------- */
  /* Documents                                                         */
  /* ---------------------------------------------------------------- */

  const replaceDocument = useCallback<DataContextValue['replaceDocument']>(
    (documentId, file) => {
      let touched: AppDocument | undefined;
      setDocuments((prev) =>
        prev.map((doc) => {
          if (doc.id !== documentId) return doc;
          touched = doc;
          return {
            ...doc,
            ...file,
            uploadedAt: nowIso(),
            status: 'Under Verification',
            remarks: 'Re-uploaded by advisor. Awaiting verification.',
          };
        }),
      );
      if (touched) {
        pushAudit('Uploaded document', 'Documents', touched.applicationId, `${touched.name} — ${file.fileName}`);
        pushNotification({
          kind: 'document',
          title: `Document received for ${touched.applicationId}`,
          body: `${touched.name} has been re-uploaded and is waiting on the verification desk.`,
          applicationId: touched.applicationId,
          audience: 'admin',
        });
      }
    },
    [pushAudit, pushNotification],
  );

  const setDocumentStatus = useCallback<DataContextValue['setDocumentStatus']>(
    (documentId, status, remarks = '') => {
      let touched: AppDocument | undefined;
      setDocuments((prev) =>
        prev.map((doc) => {
          if (doc.id !== documentId) return doc;
          touched = doc;
          return { ...doc, status, remarks };
        }),
      );
      if (!touched) return;
      const doc = touched;
      pushAudit(
        status === 'Verified'
          ? 'Verified document'
          : status === 'Re-upload Required'
            ? 'Requested re-upload'
            : status === 'Rejected'
              ? 'Rejected document'
              : 'Updated document status',
        'Documents',
        doc.applicationId,
        `${doc.name} → ${status}${remarks ? ` · ${remarks}` : ''}`,
      );
      if (status === 'Re-upload Required' || status === 'Rejected') {
        pushNotification({
          kind: 'document',
          title: `${doc.name} needs your attention`,
          body:
            remarks ||
            `${doc.name} on ${doc.applicationId} was ${status === 'Rejected' ? 'rejected' : 'sent back'} by the verification desk.`,
          applicationId: doc.applicationId,
          audience: 'advisor',
        });
      }
    },
    [pushAudit, pushNotification],
  );

  const addDocumentToApplication = useCallback<DataContextValue['addDocumentToApplication']>(
    (applicationId, doc) => {
      setDocuments((prev) => [
        {
          id: uid('DOC'),
          applicationId,
          name: doc.name,
          fileName: doc.fileName,
          fileType: doc.fileType,
          size: doc.size,
          uploadedAt: nowIso(),
          status: 'Under Verification',
          remarks: '',
          required: false,
        },
        ...prev,
      ]);
      pushAudit('Uploaded document', 'Documents', applicationId, `${doc.name} — ${doc.fileName}`);
    },
    [pushAudit],
  );

  const requestDocument = useCallback<DataContextValue['requestDocument']>(
    (applicationId, name, remarks) => {
      setDocuments((prev) => [
        {
          id: uid('DOC'),
          applicationId,
          name,
          fileName: '',
          fileType: '',
          size: 0,
          uploadedAt: null,
          status: 'Pending',
          remarks: remarks || 'Requested by the operations desk.',
          required: true,
        },
        ...prev,
      ]);
      pushAudit('Requested document', 'Documents', applicationId, `${name} requested from the advisor`);
      pushNotification({
        kind: 'document',
        title: `${name} requested for ${applicationId}`,
        body: remarks || `The operations desk has asked for ${name}. Upload it from your Documents page.`,
        applicationId,
        audience: 'advisor',
      });
    },
    [pushAudit, pushNotification],
  );

  /* ---------------------------------------------------------------- */
  /* Payouts                                                           */
  /* ---------------------------------------------------------------- */

  const updatePayoutStatus = useCallback<DataContextValue['updatePayoutStatus']>(
    (payoutId, status) => {
      const at = nowIso();
      let target: Payout | undefined;
      setPayouts((prev) =>
        prev.map((p) => {
          if (p.id !== payoutId) return p;
          target = p;
          return {
            ...p,
            status,
            paymentDate: status === 'Paid' ? at : null,
            utr: status === 'Paid' ? `UTR${Date.now().toString().slice(-10)}` : null,
          };
        }),
      );
      if (!target) return;
      const payout = target;
      pushAudit(
        status === 'Paid' ? 'Released payout' : 'Updated payout status',
        'Payouts',
        payout.applicationId,
        `${payout.id} → ${status}`,
      );
      if (status === 'Paid') {
        pushNotification({
          kind: 'payout',
          title: `Payout released for ${payout.applicationId}`,
          body: `Your payout has been credited for ${payout.customerName}.`,
          applicationId: payout.applicationId,
          audience: 'advisor',
        });
      } else {
        pushNotification({
          kind: 'payout',
          title: `Payout ${status.toLowerCase()} for ${payout.applicationId}`,
          body: `The payout against ${payout.customerName} is now ${status.toLowerCase()}.`,
          applicationId: payout.applicationId,
          audience: 'advisor',
        });
      }
    },
    [pushAudit, pushNotification],
  );

  /* ---------------------------------------------------------------- */
  /* Network — advisors, staff, lenders, products                      */
  /* ---------------------------------------------------------------- */

  const setAdvisorStatus = useCallback<DataContextValue['setAdvisorStatus']>(
    (advisorId, status) => {
      setAdvisors((prev) => prev.map((a) => (a.id === advisorId ? { ...a, status } : a)));
      const advisor = advisors.find((a) => a.id === advisorId);
      pushAudit(
        status === 'Active' ? 'Activated advisor' : 'Deactivated advisor',
        'Advisors',
        advisorId,
        `${advisor?.name ?? advisorId} set to ${status}`,
      );
    },
    [advisors, pushAudit],
  );

  const saveStaffMember = useCallback<DataContextValue['saveStaffMember']>(
    (member) => {
      let existed = false;
      setStaff((prev) => {
        existed = prev.some((s) => s.id === member.id);
        return existed ? prev.map((s) => (s.id === member.id ? member : s)) : [member, ...prev];
      });
      pushAudit(
        existed ? 'Updated staff member' : 'Added staff member',
        'Team',
        member.id,
        `${member.name} · ${member.role}`,
      );
    },
    [pushAudit],
  );

  const setStaffStatus = useCallback<DataContextValue['setStaffStatus']>(
    (staffId, status) => {
      setStaff((prev) => prev.map((s) => (s.id === staffId ? { ...s, status } : s)));
      const member = staff.find((s) => s.id === staffId);
      pushAudit(
        status === 'Active' ? 'Activated staff member' : 'Deactivated staff member',
        'Team',
        staffId,
        `${member?.name ?? staffId} set to ${status}`,
      );
    },
    [pushAudit, staff],
  );

  const saveLender = useCallback<DataContextValue['saveLender']>(
    (lender) => {
      let existed = false;
      setLenders((prev) => {
        existed = prev.some((l) => l.id === lender.id);
        return existed ? prev.map((l) => (l.id === lender.id ? lender : l)) : [lender, ...prev];
      });
      pushAudit(
        existed ? 'Updated lender' : 'Empanelled lender',
        'Lenders',
        lender.id,
        `${lender.name} · ${lender.services.length} service(s)`,
      );
    },
    [pushAudit],
  );

  const setLenderStatus = useCallback<DataContextValue['setLenderStatus']>(
    (lenderId, status) => {
      setLenders((prev) => prev.map((l) => (l.id === lenderId ? { ...l, status } : l)));
      const lender = lenders.find((l) => l.id === lenderId);
      pushAudit('Updated lender', 'Lenders', lenderId, `${lender?.name ?? lenderId} → ${status}`);
    },
    [lenders, pushAudit],
  );

  const updateProduct = useCallback<DataContextValue['updateProduct']>(
    (service, patch) => {
      setProducts((prev) => prev.map((p) => (p.service === service ? { ...p, ...patch } : p)));
      pushAudit(
        'Updated product configuration',
        'Products',
        null,
        `${service}${patch.active !== undefined ? ` → ${patch.active ? 'Active' : 'Inactive'}` : ''}`,
      );
    },
    [pushAudit],
  );

  /* ---------------------------------------------------------------- */
  /* Support                                                           */
  /* ---------------------------------------------------------------- */

  const createTicket = useCallback<DataContextValue['createTicket']>(
    (input) => {
      const at = nowIso();
      const ticket: SupportTicket = {
        id: `TK-${1100 + tickets.length}`,
        advisorId: input.advisorId,
        advisorName: input.advisorName,
        subject: input.subject,
        category: input.category,
        applicationId: input.applicationId,
        status: 'Open',
        priority: input.priority,
        createdAt: at,
        updatedAt: at,
        messages: [
          {
            id: uid('TM'),
            author: input.advisorName,
            authorRole: 'advisor',
            body: input.body,
            at,
          },
        ],
      };
      setTickets((prev) => [ticket, ...prev]);
      pushAudit('Raised support ticket', 'Support', ticket.id, input.subject);
      pushNotification({
        kind: 'alert',
        title: `New support ticket ${ticket.id}`,
        body: `${input.advisorName}: ${input.subject}`,
        applicationId: input.applicationId ?? undefined,
        audience: 'admin',
      });
      return ticket;
    },
    [pushAudit, pushNotification, tickets.length],
  );

  const replyToTicket = useCallback<DataContextValue['replyToTicket']>(
    (ticketId, body, author, role) => {
      const at = nowIso();
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                updatedAt: at,
                status: t.status === 'Open' && role === 'admin' ? 'In Progress' : t.status,
                messages: [
                  ...t.messages,
                  { id: uid('TM'), author, authorRole: role, body, at },
                ],
              }
            : t,
        ),
      );
      pushAudit('Replied to ticket', 'Support', ticketId, body.slice(0, 90));
      pushNotification({
        kind: 'alert',
        title: `Reply on ${ticketId}`,
        body: body.slice(0, 120),
        audience: role === 'admin' ? 'advisor' : 'admin',
      });
    },
    [pushAudit, pushNotification],
  );

  const setTicketStatus = useCallback<DataContextValue['setTicketStatus']>(
    (ticketId, status) => {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status, updatedAt: nowIso() } : t)),
      );
      pushAudit('Updated ticket status', 'Support', ticketId, `Status set to ${status}`);
    },
    [pushAudit],
  );

  /* ---------------------------------------------------------------- */
  /* Notifications & profile                                           */
  /* ---------------------------------------------------------------- */

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback((audience: Role) => {
    setNotifications((prev) =>
      prev.map((n) => (n.audience === audience ? { ...n, read: true } : n)),
    );
  }, []);

  const clearNotifications = useCallback((audience: Role) => {
    setNotifications((prev) => prev.filter((n) => n.audience !== audience));
  }, []);

  const updateProfile = useCallback(
    (patch: Partial<AdvisorProfile>) => {
      setProfile((prev) => ({ ...prev, ...patch }));
      pushAudit('Updated profile', 'Advisors', null, Object.keys(patch).join(', '));
    },
    [pushAudit],
  );

  /* ---------------------------------------------------------------- */
  /* Selectors                                                         */
  /* ---------------------------------------------------------------- */

  const documentsFor = useCallback(
    (applicationId: string) => documents.filter((d) => d.applicationId === applicationId),
    [documents],
  );

  const applicationById = useCallback(
    (id: string) => applications.find((a) => a.id === id),
    [applications],
  );

  const payoutFor = useCallback(
    (applicationId: string) => payouts.find((p) => p.applicationId === applicationId),
    [payouts],
  );

  const activitiesFor = useCallback(
    (applicationId: string) =>
      leadActivities
        .filter((a) => a.applicationId === applicationId)
        .sort((a, b) => +new Date(b.at) - +new Date(a.at)),
    [leadActivities],
  );

  const ticketsFor = useCallback(
    (advisorId: string) => tickets.filter((t) => t.advisorId === advisorId),
    [tickets],
  );

  const productFor = useCallback(
    (service: ServiceType) => products.find((p) => p.service === service),
    [products],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      applications,
      documents,
      payouts,
      notifications,
      advisors,
      staff,
      lenders,
      products,
      auditLog,
      leadActivities,
      tickets,
      profile,
      setAuditActor,
      submitApplication,
      updateApplicationStatus,
      updateApplicationDetails,
      assignApplication,
      updateLeadStage,
      addLeadActivity,
      replaceDocument,
      setDocumentStatus,
      addDocumentToApplication,
      requestDocument,
      updatePayoutStatus,
      setAdvisorStatus,
      saveStaffMember,
      setStaffStatus,
      saveLender,
      setLenderStatus,
      updateProduct,
      createTicket,
      replyToTicket,
      setTicketStatus,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      updateProfile,
      documentsFor,
      applicationById,
      payoutFor,
      activitiesFor,
      ticketsFor,
      productFor,
    }),
    [
      applications,
      documents,
      payouts,
      notifications,
      advisors,
      staff,
      lenders,
      products,
      auditLog,
      leadActivities,
      tickets,
      profile,
      setAuditActor,
      submitApplication,
      updateApplicationStatus,
      updateApplicationDetails,
      assignApplication,
      updateLeadStage,
      addLeadActivity,
      replaceDocument,
      setDocumentStatus,
      addDocumentToApplication,
      requestDocument,
      updatePayoutStatus,
      setAdvisorStatus,
      saveStaffMember,
      setStaffStatus,
      saveLender,
      setLenderStatus,
      updateProduct,
      createTicket,
      replyToTicket,
      setTicketStatus,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      updateProfile,
      documentsFor,
      applicationById,
      payoutFor,
      activitiesFor,
      ticketsFor,
      productFor,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
