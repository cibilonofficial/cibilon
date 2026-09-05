export const SERVICE_TYPES = [
  'Personal Loan',
  'Business Loan',
  'Home Loan',
  'Loan Against Property',
  'Vehicle Loan',
  'Credit Card',
  'Insurance',
  'Other Financial Services',
] as const;

export const LOAN_SERVICE_TYPES = new Set<string>([
  'Personal Loan',
  'Business Loan',
  'Home Loan',
  'Loan Against Property',
  'Vehicle Loan',
]);

export const LEAD_STAGES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'DOCUMENTS_PENDING',
  'CONVERTED',
  'DROPPED',
] as const;

export const LEAD_STATUSES = ['DRAFT', 'ACTIVE', 'CONVERTED', 'ARCHIVED'] as const;

export const ACTIVITY_KINDS = [
  'CALL',
  'MEETING',
  'EMAIL',
  'NOTE',
  'STAGE_CHANGE',
  'FOLLOW_UP',
  'CONVERSION',
] as const;

export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'DOCUMENTS_PENDING',
  'SENT_TO_LENDER',
  'LENDER_PROCESSING',
  'APPROVED',
  'REJECTED',
  'DISBURSED',
  'CANCELLED',
] as const;

export const APPLICATION_ACTIVITY_KINDS = ['CALL', 'EMAIL', 'MEETING', 'NOTE'] as const;

export const TERMINAL_APPLICATION_STATUSES = new Set<string>([
  'REJECTED',
  'DISBURSED',
  'CANCELLED',
]);

export const APPLICATION_STATUS_TRANSITIONS: Record<
  (typeof APPLICATION_STATUSES)[number],
  readonly (typeof APPLICATION_STATUSES)[number][]
> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW', 'DOCUMENTS_PENDING', 'SENT_TO_LENDER', 'LENDER_PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['DOCUMENTS_PENDING', 'SENT_TO_LENDER', 'LENDER_PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED'],
  DOCUMENTS_PENDING: ['UNDER_REVIEW', 'SENT_TO_LENDER', 'LENDER_PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED'],
  SENT_TO_LENDER: ['UNDER_REVIEW', 'DOCUMENTS_PENDING', 'LENDER_PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED'],
  LENDER_PROCESSING: ['UNDER_REVIEW', 'DOCUMENTS_PENDING', 'SENT_TO_LENDER', 'APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['DISBURSED', 'CANCELLED'],
  REJECTED: [],
  DISBURSED: [],
  CANCELLED: [],
};

type ChecklistItem = { documentType: string; displayName: string; required: boolean };

export const DOCUMENT_CHECKLISTS: Record<(typeof SERVICE_TYPES)[number], ChecklistItem[]> = {
  'Personal Loan': [
    { documentType: 'pan_card', displayName: 'PAN Card', required: true },
    { documentType: 'aadhaar_card', displayName: 'Aadhaar Card', required: true },
    { documentType: 'address_proof', displayName: 'Address Proof', required: true },
    { documentType: 'salary_slips_3m', displayName: 'Salary Slips (3 months)', required: true },
    { documentType: 'bank_statements_6m', displayName: 'Bank Statements (6 months)', required: true },
    { documentType: 'photograph', displayName: 'Photograph', required: true },
    { documentType: 'form16_or_itr', displayName: 'Form 16 / ITR', required: false },
  ],
  'Business Loan': [
    { documentType: 'pan_card', displayName: 'PAN Card', required: true },
    { documentType: 'aadhaar_card', displayName: 'Aadhaar Card', required: true },
    { documentType: 'business_proof', displayName: 'Business Proof', required: true },
    { documentType: 'gst_documents', displayName: 'GST Documents', required: true },
    { documentType: 'itr_2y', displayName: 'ITR (2 years)', required: true },
    { documentType: 'bank_statements_12m', displayName: 'Bank Statements (12 months)', required: true },
    { documentType: 'photograph', displayName: 'Photograph', required: true },
    { documentType: 'audited_financials', displayName: 'Audited Financials', required: false },
  ],
  'Home Loan': [
    { documentType: 'pan_card', displayName: 'PAN Card', required: true },
    { documentType: 'aadhaar_card', displayName: 'Aadhaar Card', required: true },
    { documentType: 'address_proof', displayName: 'Address Proof', required: true },
    { documentType: 'salary_slips_3m', displayName: 'Salary Slips (3 months)', required: true },
    { documentType: 'bank_statements_6m', displayName: 'Bank Statements (6 months)', required: true },
    { documentType: 'property_documents', displayName: 'Property Documents', required: true },
    { documentType: 'itr_2y', displayName: 'ITR (2 years)', required: false },
    { documentType: 'photograph', displayName: 'Photograph', required: true },
  ],
  'Loan Against Property': [
    { documentType: 'pan_card', displayName: 'PAN Card', required: true },
    { documentType: 'aadhaar_card', displayName: 'Aadhaar Card', required: true },
    { documentType: 'property_documents', displayName: 'Property Documents', required: true },
    { documentType: 'bank_statements_12m', displayName: 'Bank Statements (12 months)', required: true },
    { documentType: 'itr_2y', displayName: 'ITR (2 years)', required: true },
    { documentType: 'photograph', displayName: 'Photograph', required: true },
  ],
  'Vehicle Loan': [
    { documentType: 'pan_card', displayName: 'PAN Card', required: true },
    { documentType: 'aadhaar_card', displayName: 'Aadhaar Card', required: true },
    { documentType: 'address_proof', displayName: 'Address Proof', required: true },
    { documentType: 'bank_statements_6m', displayName: 'Bank Statements (6 months)', required: true },
    { documentType: 'proforma_invoice', displayName: 'Proforma Invoice', required: true },
    { documentType: 'driving_licence', displayName: 'Driving Licence', required: false },
    { documentType: 'photograph', displayName: 'Photograph', required: true },
  ],
  'Credit Card': [
    { documentType: 'pan_card', displayName: 'PAN Card', required: true },
    { documentType: 'aadhaar_card', displayName: 'Aadhaar Card', required: true },
    { documentType: 'salary_slips_3m', displayName: 'Salary Slips (3 months)', required: true },
    { documentType: 'bank_statements_3m', displayName: 'Bank Statements (3 months)', required: false },
    { documentType: 'photograph', displayName: 'Photograph', required: true },
  ],
  Insurance: [
    { documentType: 'pan_card', displayName: 'PAN Card', required: true },
    { documentType: 'aadhaar_card', displayName: 'Aadhaar Card', required: true },
    { documentType: 'address_proof', displayName: 'Address Proof', required: true },
    { documentType: 'medical_reports', displayName: 'Medical Reports', required: false },
    { documentType: 'photograph', displayName: 'Photograph', required: true },
  ],
  'Other Financial Services': [
    { documentType: 'pan_card', displayName: 'PAN Card', required: true },
    { documentType: 'aadhaar_card', displayName: 'Aadhaar Card', required: true },
    { documentType: 'address_proof', displayName: 'Address Proof', required: true },
    { documentType: 'other_documents', displayName: 'Other Documents', required: false },
  ],
};
