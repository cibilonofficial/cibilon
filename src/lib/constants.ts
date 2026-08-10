import type {
  ApplicationStatus,
  AuditModule,
  DocumentStatus,
  LeadStage,
  LenderStatus,
  LenderType,
  PayoutStatus,
  ServiceType,
  StaffRole,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@/types';

export const SERVICES: ServiceType[] = [
  'Personal Loan',
  'Business Loan',
  'Home Loan',
  'Loan Against Property',
  'Vehicle Loan',
  'Credit Card',
  'Insurance',
  'Other Financial Services',
];

/** Services that carry an amount + tenure. */
export const LOAN_SERVICES: ServiceType[] = [
  'Personal Loan',
  'Business Loan',
  'Home Loan',
  'Loan Against Property',
  'Vehicle Loan',
];

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Draft',
  'Submitted',
  'Under Review',
  'Documents Required',
  'Processing',
  'Submitted to Lender',
  'Additional Information Required',
  'Approved',
  'Rejected',
  'Disbursed',
  'Completed',
];

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  'Pending',
  'Uploaded',
  'Under Verification',
  'Verified',
  'Rejected',
  'Re-upload Required',
];

export const PAYOUT_STATUSES: PayoutStatus[] = ['Pending', 'Processing', 'Paid'];

/**
 * The happy-path pipeline rendered by the application timeline. Exception
 * states ("Documents Required", "Rejected", …) are folded onto the stage they
 * interrupt rather than getting their own node.
 */
export const PIPELINE: ApplicationStatus[] = [
  'Submitted',
  'Under Review',
  'Processing',
  'Submitted to Lender',
  'Approved',
  'Disbursed',
  'Completed',
];

export const PIPELINE_LABELS: Record<string, string> = {
  Submitted: 'Application Submitted',
  'Under Review': 'Documents Under Review',
  Processing: 'Processing',
  'Submitted to Lender': 'Submitted to Lender',
  Approved: 'Approved',
  Disbursed: 'Disbursed',
  Completed: 'Payout Generated',
};

/** Exception statuses map onto the pipeline node they pause. */
export const STATUS_PIPELINE_ANCHOR: Record<ApplicationStatus, ApplicationStatus> = {
  Draft: 'Submitted',
  Submitted: 'Submitted',
  'Under Review': 'Under Review',
  'Documents Required': 'Under Review',
  Processing: 'Processing',
  'Submitted to Lender': 'Submitted to Lender',
  'Additional Information Required': 'Submitted to Lender',
  Approved: 'Approved',
  Rejected: 'Approved',
  Disbursed: 'Disbursed',
  Completed: 'Completed',
};

type Tone = {
  badge: string;
  dot: string;
  /** Solid hex, for charts. */
  hex: string;
};

export const STATUS_TONES: Record<ApplicationStatus, Tone> = {
  Draft: { badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400', hex: '#94a3b8' },
  Submitted: { badge: 'bg-brand-50 text-brand-700 ring-brand-200', dot: 'bg-brand-500', hex: '#2b5fa8' },
  'Under Review': {
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    dot: 'bg-sky-500',
    hex: '#0ea5e9',
  },
  'Documents Required': {
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    hex: '#f59e0b',
  },
  Processing: {
    badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    dot: 'bg-indigo-500',
    hex: '#6366f1',
  },
  'Submitted to Lender': {
    badge: 'bg-violet-50 text-violet-700 ring-violet-200',
    dot: 'bg-violet-500',
    hex: '#8b5cf6',
  },
  'Additional Information Required': {
    badge: 'bg-orange-50 text-orange-700 ring-orange-200',
    dot: 'bg-orange-500',
    hex: '#f97316',
  },
  Approved: {
    badge: 'bg-money-50 text-money-700 ring-money-500/25',
    dot: 'bg-money-500',
    hex: '#2fa27a',
  },
  Rejected: { badge: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500', hex: '#e11d48' },
  Disbursed: {
    badge: 'bg-teal-50 text-teal-700 ring-teal-200',
    dot: 'bg-teal-500',
    hex: '#14b8a6',
  },
  Completed: {
    badge: 'bg-slate-800 text-white ring-slate-800',
    dot: 'bg-slate-200',
    hex: '#1e293b',
  },
};

export const DOC_STATUS_TONES: Record<DocumentStatus, Tone> = {
  Pending: { badge: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400', hex: '#94a3b8' },
  Uploaded: { badge: 'bg-brand-50 text-brand-700 ring-brand-200', dot: 'bg-brand-500', hex: '#2b5fa8' },
  'Under Verification': {
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    dot: 'bg-sky-500',
    hex: '#0ea5e9',
  },
  Verified: {
    badge: 'bg-money-50 text-money-700 ring-money-500/25',
    dot: 'bg-money-500',
    hex: '#2fa27a',
  },
  Rejected: { badge: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500', hex: '#e11d48' },
  'Re-upload Required': {
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    hex: '#f59e0b',
  },
};

export const PAYOUT_TONES: Record<PayoutStatus, Tone> = {
  Pending: { badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500', hex: '#f59e0b' },
  Processing: { badge: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500', hex: '#0ea5e9' },
  Paid: {
    badge: 'bg-money-50 text-money-700 ring-money-500/25',
    dot: 'bg-money-500',
    hex: '#2fa27a',
  },
};

/** Document checklist per service. `true` = mandatory before submission. */
export const DOCUMENT_CHECKLIST: Record<ServiceType, { name: string; required: boolean }[]> = {
  'Personal Loan': [
    { name: 'PAN Card', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'Address Proof', required: true },
    { name: 'Salary Slips (3 months)', required: true },
    { name: 'Bank Statements (6 months)', required: true },
    { name: 'Photograph', required: true },
    { name: 'Form 16 / ITR', required: false },
  ],
  'Business Loan': [
    { name: 'PAN Card', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'Business Proof', required: true },
    { name: 'GST Documents', required: true },
    { name: 'ITR (2 years)', required: true },
    { name: 'Bank Statements (12 months)', required: true },
    { name: 'Photograph', required: true },
    { name: 'Audited Financials', required: false },
  ],
  'Home Loan': [
    { name: 'PAN Card', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'Address Proof', required: true },
    { name: 'Salary Slips (3 months)', required: true },
    { name: 'Bank Statements (6 months)', required: true },
    { name: 'Property Documents', required: true },
    { name: 'ITR (2 years)', required: false },
    { name: 'Photograph', required: true },
  ],
  'Loan Against Property': [
    { name: 'PAN Card', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'Property Documents', required: true },
    { name: 'Bank Statements (12 months)', required: true },
    { name: 'ITR (2 years)', required: true },
    { name: 'Photograph', required: true },
  ],
  'Vehicle Loan': [
    { name: 'PAN Card', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'Address Proof', required: true },
    { name: 'Bank Statements (6 months)', required: true },
    { name: 'Proforma Invoice', required: true },
    { name: 'Driving Licence', required: false },
    { name: 'Photograph', required: true },
  ],
  'Credit Card': [
    { name: 'PAN Card', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'Salary Slips (3 months)', required: true },
    { name: 'Bank Statements (3 months)', required: false },
    { name: 'Photograph', required: true },
  ],
  Insurance: [
    { name: 'PAN Card', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'Address Proof', required: true },
    { name: 'Medical Reports', required: false },
    { name: 'Photograph', required: true },
  ],
  'Other Financial Services': [
    { name: 'PAN Card', required: true },
    { name: 'Aadhaar Card', required: true },
    { name: 'Address Proof', required: true },
    { name: 'Other Documents', required: false },
  ],
};

/** Indicative commission rate (% of disbursed amount) used for payout estimates. */
export const PAYOUT_RATES: Record<ServiceType, number> = {
  'Personal Loan': 1.6,
  'Business Loan': 1.8,
  'Home Loan': 0.6,
  'Loan Against Property': 0.9,
  'Vehicle Loan': 1.2,
  'Credit Card': 0,
  Insurance: 0,
  'Other Financial Services': 1.0,
};

/** Flat payout for non-amount services, in rupees. */
export const FLAT_PAYOUTS: Partial<Record<ServiceType, number>> = {
  'Credit Card': 2500,
  Insurance: 4500,
};

/* ------------------------------------------------------------------ */
/* Lead pipeline                                                       */
/* ------------------------------------------------------------------ */

export const LEAD_STAGES: LeadStage[] = [
  'New',
  'Contacted',
  'Qualified',
  'Documents Pending',
  'Converted',
  'Dropped',
];

export const LEAD_STAGE_TONES: Record<LeadStage, Tone> = {
  New: { badge: 'bg-brand-50 text-brand-700 ring-brand-200', dot: 'bg-brand-500', hex: '#2b5fa8' },
  Contacted: { badge: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500', hex: '#0ea5e9' },
  Qualified: {
    badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    dot: 'bg-indigo-500',
    hex: '#6366f1',
  },
  'Documents Pending': {
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    hex: '#f59e0b',
  },
  Converted: {
    badge: 'bg-money-50 text-money-700 ring-money-500/25',
    dot: 'bg-money-500',
    hex: '#2fa27a',
  },
  Dropped: { badge: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400', hex: '#94a3b8' },
};

/* ------------------------------------------------------------------ */
/* Team, lenders, support                                              */
/* ------------------------------------------------------------------ */

export const STAFF_ROLES: StaffRole[] = [
  'Operations Manager',
  'Credit Analyst',
  'Verification Officer',
  'Payout Executive',
  'Relationship Manager',
];

/** What each role is allowed to touch — surfaced on the Team page. */
export const ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
  'Operations Manager': [
    'Assign applications',
    'Update any status',
    'Manage lenders & products',
    'Release payouts',
  ],
  'Credit Analyst': ['Update application status', 'Add processing remarks', 'Request documents'],
  'Verification Officer': ['Verify documents', 'Request re-uploads', 'Update KYC status'],
  'Payout Executive': ['Process payouts', 'Mark payouts paid', 'Export payout reports'],
  'Relationship Manager': ['Manage advisors', 'Respond to support tickets', 'View reports'],
};

export const LENDER_TYPES: LenderType[] = ['Bank', 'NBFC', 'HFC', 'Fintech', 'Insurer'];
export const LENDER_STATUSES: LenderStatus[] = ['Active', 'Paused', 'Inactive'];

export const LENDER_TONES: Record<LenderStatus, Tone> = {
  Active: {
    badge: 'bg-money-50 text-money-700 ring-money-500/25',
    dot: 'bg-money-500',
    hex: '#2fa27a',
  },
  Paused: { badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500', hex: '#f59e0b' },
  Inactive: {
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
    hex: '#94a3b8',
  },
};

export const AUDIT_MODULES: AuditModule[] = [
  'Leads',
  'Applications',
  'Documents',
  'Advisors',
  'Team',
  'Lenders',
  'Products',
  'Payouts',
  'Support',
  'Auth',
];

export const TICKET_STATUSES: TicketStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const TICKET_PRIORITIES: TicketPriority[] = ['Low', 'Normal', 'High', 'Urgent'];
export const TICKET_CATEGORIES: TicketCategory[] = [
  'Application query',
  'Document issue',
  'Payout query',
  'Account & access',
  'Product information',
  'Other',
];

export const TICKET_TONES: Record<TicketStatus, Tone> = {
  Open: { badge: 'bg-brand-50 text-brand-700 ring-brand-200', dot: 'bg-brand-500', hex: '#2b5fa8' },
  'In Progress': {
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    hex: '#f59e0b',
  },
  Resolved: {
    badge: 'bg-money-50 text-money-700 ring-money-500/25',
    dot: 'bg-money-500',
    hex: '#2fa27a',
  },
  Closed: { badge: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400', hex: '#94a3b8' },
};

export const PRIORITY_TONES: Record<TicketPriority, Tone> = {
  Low: { badge: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400', hex: '#94a3b8' },
  Normal: { badge: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500', hex: '#0ea5e9' },
  High: { badge: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500', hex: '#f59e0b' },
  Urgent: { badge: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500', hex: '#e11d48' },
};

export const LENDERS = [
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'State Bank of India',
  'Kotak Mahindra Bank',
  'Bajaj Finserv',
  'Tata Capital',
  'IDFC First Bank',
  'Yes Bank',
  'Aditya Birla Finance',
  'No preference',
];

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export const LOAN_PURPOSES = [
  'Debt Consolidation',
  'Home Renovation',
  'Wedding',
  'Medical Expenses',
  'Education',
  'Travel',
  'Working Capital',
  'Business Expansion',
  'Equipment Purchase',
  'Property Purchase',
  'Vehicle Purchase',
  'Other',
];
