/** Domain model for the Cibilon CRM. */

export type Role = 'advisor' | 'admin' | 'staff';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: Role;
  permissions: string[];
  /** DSA code for advisors, employee code for admins. */
  code: string;
  agency?: string;
  avatarColor: string;
}

export type ApplicationStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Documents Required'
  | 'Processing'
  | 'Submitted to Lender'
  | 'Additional Information Required'
  | 'Approved'
  | 'Rejected'
  | 'Disbursed'
  | 'Completed';

export type DocumentStatus =
  | 'Pending'
  | 'Uploaded'
  | 'Under Verification'
  | 'Verified'
  | 'Rejected'
  | 'Re-upload Required';

export type PayoutStatus = 'Pending' | 'Processing' | 'Paid';

export type ServiceType =
  | 'Personal Loan'
  | 'Business Loan'
  | 'Home Loan'
  | 'Loan Against Property'
  | 'Vehicle Loan'
  | 'Credit Card'
  | 'Insurance'
  | 'Other Financial Services';

export type EmploymentType = 'Salaried' | 'Self Employed' | 'Business' | 'Other';

export type Gender = 'Male' | 'Female' | 'Other';

export interface CustomerInfo {
  fullName: string;
  mobile: string;
  email: string;
  dob: string;
  gender: Gender | '';
  pan: string;
  aadhaar: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface EmploymentInfo {
  employmentType: EmploymentType | '';
  monthlyIncome: string;
  organisation: string;
  /** Years at current job / in business. */
  experience: string;
  designation: string;
  businessVintage: string;
  businessType: string;
  gstin: string;
  natureOfWork: string;
  existingLoans: 'Yes' | 'No' | '';
  existingEmi: string;
  creditScore: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
}

export interface ServiceDetails {
  category?: import('../../shared/service-categories.js').ServiceCategory;
  categoryFields?: Record<string, string>;
  service: ServiceType | '';
  /** Loan-shaped services. */
  loanAmount: string;
  tenure: string;
  purpose: string;
  preferredLender: string;
  /** Credit card. */
  cardCategory: string;
  existingCards: string;
  /** Insurance. */
  insuranceType: string;
  sumAssured: string;
  premiumFrequency: string;
  /** Other. */
  serviceNotes: string;
}

export interface AppDocument {
  id: string;
  applicationId: string;
  name: string;
  fileName: string;
  fileType: string;
  /** Bytes. */
  size: number;
  uploadedAt: string | null;
  status: DocumentStatus;
  remarks: string;
  required: boolean;
}

export interface TimelineEvent {
  id: string;
  stage: ApplicationStatus;
  label: string;
  note: string;
  actor: string;
  at: string;
}

export interface Payout {
  id: string;
  applicationId: string;
  advisorId: string;
  customerName: string;
  service: ServiceType;
  loanAmount: number;
  payoutAmount: number;
  /** Commission as a percentage of the disbursed amount. */
  payoutRate: number;
  /** True while the application is approved but not yet disbursed. */
  estimated: boolean;
  disbursementDate: string | null;
  status: PayoutStatus;
  paymentDate: string | null;
  utr: string | null;
}

export interface Application {
  id: string;
  customerId?: string;
  leadId: string;
  advisorId: string;
  advisorName: string;
  customer: CustomerInfo;
  employment: EmploymentInfo;
  serviceDetails: ServiceDetails;
  service: ServiceType;
  loanAmount: number;
  status: ApplicationStatus;
  /** Where the lead sits before/alongside the formal application status. */
  leadStage: LeadStage;
  /** Free-text describing who inside the ops team owns it now. */
  processingStage: string;
  /** Display name of the owning staff member; kept in sync with assignedStaffId. */
  assignedTo: string;
  assignedStaffId: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  expectedPayout: number;
  adminRemarks: string;
  requiredActions: string[];
  timeline: TimelineEvent[];
  lender: string;
  source: string;
}

export interface Advisor {
  id: string;
  name: string;
  code: string;
  email: string;
  mobile: string;
  agency: string;
  city: string;
  joinedOn: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  avatarColor: string;
}

export type NotificationKind = 'document' | 'status' | 'payout' | 'approval' | 'alert';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  applicationId?: string;
  audience: Role;
  at: string;
  read: boolean;
}

/* ------------------------------------------------------------------ */
/* Lead pipeline                                                       */
/* ------------------------------------------------------------------ */

export type LeadStage =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Documents Pending'
  | 'Converted'
  | 'Dropped';

export type LeadActivityKind = 'Call' | 'Meeting' | 'Email' | 'Note' | 'Assignment' | 'Stage';

export interface LeadActivity {
  id: string;
  applicationId: string;
  kind: LeadActivityKind;
  note: string;
  actor: string;
  at: string;
}

/* ------------------------------------------------------------------ */
/* Internal team                                                       */
/* ------------------------------------------------------------------ */

export type StaffRole =
  | 'Operations Manager'
  | 'Credit Analyst'
  | 'Verification Officer'
  | 'Payout Executive'
  | 'Relationship Manager';

export interface StaffMember {
  id: string;
  name: string;
  code: string;
  email: string;
  mobile: string;
  role: StaffRole;
  department: string;
  status: 'Active' | 'Inactive';
  joinedOn: string;
  avatarColor: string;
  /** Used only while creating a staff account; never returned by the API. */
  initialPassword?: string;
}

/* ------------------------------------------------------------------ */
/* Lenders & partners                                                  */
/* ------------------------------------------------------------------ */

export type LenderType = 'Bank' | 'NBFC' | 'HFC' | 'Fintech' | 'Insurer';
export type LenderStatus = 'Active' | 'Paused' | 'Inactive';

export interface Lender {
  id: string;
  name: string;
  type: LenderType;
  status: LenderStatus;
  services: ServiceType[];
  /** Commission percentage offered, keyed by service. */
  commission: Partial<Record<ServiceType, number>>;
  turnaroundDays: number;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  empanelledOn: string;
  notes: string;
}

/* ------------------------------------------------------------------ */
/* Product configuration                                               */
/* ------------------------------------------------------------------ */

export interface ProductConfig {
  /** Backend catalog identifier. */
  id?: string;
  service: ServiceType;
  active: boolean;
  tagline: string;
  /** Amount-based products only; 0 for card/insurance. */
  minAmount: number;
  maxAmount: number;
  minTenure: number;
  maxTenure: number;
  interestFrom: number;
  interestTo: number;
  /** Percentage of disbursal. */
  payoutRate: number;
  /** Flat rupee payout for products without an amount. */
  flatPayout: number | null;
  commissionOptions?: {
    id: string;
    lenderId: string | null;
    lenderName: string;
    calculationType: 'PERCENTAGE' | 'FLAT';
    percentageRate: number | null;
    flatAmount: number | null;
    effectiveFrom: string;
  }[];
  documents: { name: string; required: boolean }[];
  eligibility: string[];
  lenderIds: string[];
}

export interface PayoutRateCardEntry {
  id: string;
  categoryId: string;
  categoryName: string;
  providerName: string;
  productName: string;
  payoutText: string;
  percentageRate: number | null;
  notes: string | null;
  sortOrder: number;
  effectiveMonth: string;
}

/* ------------------------------------------------------------------ */
/* Audit trail                                                         */
/* ------------------------------------------------------------------ */

export type AuditModule =
  | 'Leads'
  | 'Applications'
  | 'Documents'
  | 'Advisors'
  | 'Team'
  | 'Lenders'
  | 'Products'
  | 'Payouts'
  | 'Support'
  | 'Auth';

export interface AuditEntry {
  id: string;
  at: string;
  actorName: string;
  actorRole: Role | 'System';
  action: string;
  module: AuditModule;
  /** The lead/application/payout this touched, when relevant. */
  entityId: string | null;
  details: string;
  ip: string;
}

/* ------------------------------------------------------------------ */
/* Advisor support                                                     */
/* ------------------------------------------------------------------ */

export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type TicketPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type TicketCategory =
  | 'Application query'
  | 'Document issue'
  | 'Payout query'
  | 'Account & access'
  | 'Product information'
  | 'Other';

export interface TicketMessage {
  id: string;
  author: string;
  authorRole: Role;
  body: string;
  at: string;
}

export interface SupportTicket {
  id: string;
  advisorId: string;
  advisorName: string;
  subject: string;
  category: TicketCategory;
  applicationId: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface AdvisorProfile {
  name: string;
  email: string;
  mobile: string;
  dsaId: string;
  agency: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  accountHolder: string;
  panNumber: string;
  accountStatus: 'Active' | 'Inactive';
  photo: string | null;
}
