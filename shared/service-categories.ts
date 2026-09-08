export const SERVICE_CATEGORIES = ['Loan', 'CIBIL Repair', 'Insurance', 'Government Schemes', 'Other Registration Services'] as const;
export type ServiceCategory = typeof SERVICE_CATEGORIES[number];
export const CATEGORY_DESCRIPTIONS: Record<ServiceCategory, string> = {
  Loan: 'Personal, business, home, property and vehicle loans; credit cards',
  'CIBIL Repair': 'Credit report review and dispute assistance',
  Insurance: 'Life, health, motor and general insurance enquiries',
  'Government Schemes': 'Scheme enquiries and application assistance',
  'Other Registration Services': 'Business, tax and other registration assistance',
};

export function categoryFor(service: string, category?: unknown): ServiceCategory {
  if (service === 'Insurance') return 'Insurance';
  if (['Personal Loan', 'Business Loan', 'Home Loan', 'Loan Against Property', 'Vehicle Loan', 'Credit Card'].includes(service)) return 'Loan';
  if (['CIBIL Repair', 'Government Schemes', 'Other Registration Services'].includes(String(category))) return category as ServiceCategory;
  return 'Other Registration Services';
}

export interface CategoryField {
  key: string; label: string; required?: boolean; options?: readonly string[];
  type?: 'text' | 'number' | 'date' | 'textarea'; min?: number; max?: number;
}

export const CATEGORY_FIELDS: Record<ServiceCategory, readonly CategoryField[]> = {
  Loan: [],
  Insurance: [
    { key: 'insuredPerson', label: 'Person or entity to be insured', required: true },
    { key: 'coverageNeeds', label: 'Coverage needs / persons or asset to cover', type: 'textarea', required: true },
    { key: 'existingCover', label: 'Existing insurance cover', options: ['Yes', 'No', 'Not known'], required: true },
    { key: 'renewalDate', label: 'Existing policy renewal date (if applicable)', type: 'date' },
  ],
  'CIBIL Repair': [
    { key: 'repairService', label: 'Assistance required', required: true, options: ['Credit report review', 'Incorrect account or payment information', 'Duplicate account', 'Unrecognized account or enquiry', 'Dispute follow-up', 'Other credit report issue'] },
    { key: 'currentScore', label: 'Current CIBIL score (if known)', type: 'number', min: 300, max: 900 },
    { key: 'reportDate', label: 'Credit report date (if available)', type: 'date' },
    { key: 'creditIssue', label: 'Describe the report issue and lender involved', required: true, type: 'textarea' },
    { key: 'previousDispute', label: 'Previously raised a dispute?', options: ['Yes', 'No', 'Not known'], required: true },
    { key: 'disputeReference', label: 'Existing dispute reference (if available)' },
  ],
  'Government Schemes': [
    { key: 'schemeName', label: 'Scheme name / assistance requested', required: true },
    { key: 'schemeAuthority', label: 'Department / implementing authority (if known)' },
    { key: 'schemeState', label: 'State / Union Territory', required: true },
    { key: 'schemeDistrict', label: 'District', required: true },
    { key: 'applicantType', label: 'Applicant type', required: true, options: ['Individual', 'Farmer', 'Student', 'Business / MSME', 'Self-help group', 'Other'] },
    { key: 'householdIncome', label: 'Annual household income (₹, if relevant)', type: 'number', min: 0 },
    { key: 'schemeAssistance', label: 'Assistance needed', required: true, options: ['Eligibility enquiry', 'New application', 'Application follow-up', 'Correction / renewal'] },
    { key: 'schemeReference', label: 'Existing application reference (if available)' },
  ],
  'Other Registration Services': [
    { key: 'registrationType', label: 'Registration service', required: true, options: ['GST registration', 'Udyam / MSME registration', 'Business / company registration', 'Shop and establishment registration', 'FSSAI registration / licence', 'PAN / TAN assistance', 'Other registration service'] },
    { key: 'entityName', label: 'Applicant / business / proposed entity name', required: true },
    { key: 'entityType', label: 'Entity type', required: true, options: ['Individual', 'Sole proprietorship', 'Partnership', 'LLP', 'Private limited company', 'Trust / society', 'Other'] },
    { key: 'registrationState', label: 'State / Union Territory', required: true },
    { key: 'businessActivity', label: 'Business activity / registration purpose', required: true, type: 'textarea' },
    { key: 'registrationAction', label: 'Request type', required: true, options: ['New registration', 'Amendment', 'Renewal', 'Status follow-up'] },
    { key: 'existingRegistration', label: 'Existing registration reference (if applicable)' },
  ],
};

export function validateCategoryFields(category: ServiceCategory, values: Record<string, string> = {}) {
  const errors: Record<string, string> = {};
  const fields = CATEGORY_FIELDS[category];
  const allowed = new Set(fields.map((field) => field.key));
  for (const key of Object.keys(values)) if (!allowed.has(key)) errors[key] = 'Unsupported category field.';
  for (const field of fields) {
    const value = values[field.key]?.trim() ?? '';
    if (!value) { if (field.required) errors[field.key] = `${field.label} is required.`; continue; }
    if (value.length > 2000) errors[field.key] = 'Use no more than 2,000 characters.';
    if (field.options && !field.options.includes(value)) errors[field.key] = 'Select a valid option.';
    if (field.type === 'number' && (!Number.isFinite(Number(value)) || (field.min !== undefined && Number(value) < field.min) || (field.max !== undefined && Number(value) > field.max))) errors[field.key] = `Enter a valid number${field.min !== undefined ? ` from ${field.min}` : ''}${field.max !== undefined ? ` to ${field.max}` : ''}.`;
    if (field.key === 'currentScore' && !Number.isInteger(Number(value))) errors[field.key] = 'Enter a whole-number score.';
    if (field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) errors[field.key] = 'Enter a valid date.';
  }
  return errors;
}

const identity = [
  { documentType: 'pan_card', displayName: 'PAN Card', required: true },
  { documentType: 'aadhaar_card', displayName: 'Aadhaar Card', required: true },
  { documentType: 'address_proof', displayName: 'Address Proof', required: true },
];
/** Intake checklist; the processing desk may request additional service-specific documents. */
export const CATEGORY_DOCUMENTS = {
  'CIBIL Repair': [...identity,
    { documentType: 'credit_report', displayName: 'Credit Report (if available)', required: false },
    { documentType: 'credit_supporting', displayName: 'Dispute Supporting Documents', required: false }],
  'Government Schemes': [...identity,
    { documentType: 'eligibility_proof', displayName: 'Scheme Eligibility Documents', required: false },
    { documentType: 'scheme_reference', displayName: 'Existing Scheme Application', required: false }],
  'Other Registration Services': [...identity,
    { documentType: 'business_proof', displayName: 'Business / Entity Proof', required: false },
    { documentType: 'premises_proof', displayName: 'Business Premises Proof', required: false },
    { documentType: 'existing_registration', displayName: 'Existing Registration Certificate', required: false }],
};
