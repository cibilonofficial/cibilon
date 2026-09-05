import {
  DOCUMENT_CHECKLIST,
  FLAT_PAYOUTS,
  LOAN_SERVICES,
  PAYOUT_RATES,
  PIPELINE,
  PIPELINE_LABELS,
} from '@/lib/constants';
import { ASSIGNABLE_STAFF } from '@/data/team';
import { daysAgo } from '@/lib/utils';
import type {
  Advisor,
  AdvisorProfile,
  AppDocument,
  AppNotification,
  Application,
  ApplicationStatus,
  AuthUser,
  DocumentStatus,
  EmploymentInfo,
  LeadStage,
  Payout,
  ServiceDetails,
  ServiceType,
  TimelineEvent,
} from '@/types';

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

export const DEMO_ACCOUNTS: (AuthUser & { password: string })[] = [
  {
    id: 'ADV-1042',
    name: 'Rohan Mehta',
    email: 'advisor@cibilon.in',
    mobile: '+91 98204 41207',
    role: 'advisor',
    permissions: [],
    code: 'DSA-1042',
    agency: 'Mehta Financial Services',
    avatarColor: 'bg-brand-600',
    password: 'cibilon@123',
  },
  {
    id: 'EMP-004',
    name: 'Ananya Iyer',
    email: 'admin@cibilon.in',
    mobile: '+91 98450 77120',
    role: 'admin',
    permissions: [],
    code: 'OPS-004',
    agency: 'Cibilon — Operations',
    avatarColor: 'bg-slate-800',
    password: 'cibilon@123',
  },
];

export const ADVISORS: Advisor[] = [
  {
    id: 'ADV-1042',
    name: 'Rohan Mehta',
    code: 'DSA-1042',
    email: 'advisor@cibilon.in',
    mobile: '+91 98204 41207',
    agency: 'Mehta Financial Services',
    city: 'Mumbai',
    joinedOn: daysAgo(420),
    status: 'Active',
    avatarColor: 'bg-brand-600',
  },
  {
    id: 'ADV-1088',
    name: 'Priya Nair',
    code: 'DSA-1088',
    email: 'priya.nair@partner.cibilon.in',
    mobile: '+91 99456 20811',
    agency: 'Nair Capital Advisors',
    city: 'Bengaluru',
    joinedOn: daysAgo(310),
    status: 'Active',
    avatarColor: 'bg-indigo-600',
  },
  {
    id: 'ADV-1113',
    name: 'Vikram Singh',
    code: 'DSA-1113',
    email: 'vikram.singh@partner.cibilon.in',
    mobile: '+91 98110 33427',
    agency: 'Singh Loan Desk',
    city: 'New Delhi',
    joinedOn: daysAgo(265),
    status: 'Active',
    avatarColor: 'bg-teal-600',
  },
  {
    id: 'ADV-1156',
    name: 'Sneha Kulkarni',
    code: 'DSA-1156',
    email: 'sneha.k@partner.cibilon.in',
    mobile: '+91 90210 78455',
    agency: 'Kulkarni Associates',
    city: 'Pune',
    joinedOn: daysAgo(190),
    status: 'Active',
    avatarColor: 'bg-violet-600',
  },
  {
    id: 'ADV-1201',
    name: 'Arjun Reddy',
    code: 'DSA-1201',
    email: 'arjun.reddy@partner.cibilon.in',
    mobile: '+91 99590 11284',
    agency: 'Reddy Fincorp',
    city: 'Hyderabad',
    joinedOn: daysAgo(95),
    status: 'Inactive',
    avatarColor: 'bg-amber-600',
  },
  {
    id: 'ADV-1230',
    name: 'Meera Joshi',
    code: 'DSA-1230',
    email: 'meera.joshi@partner.cibilon.in',
    mobile: '+91 88790 65310',
    agency: 'Joshi Money Matters',
    city: 'Ahmedabad',
    joinedOn: daysAgo(48),
    status: 'Active',
    avatarColor: 'bg-rose-600',
  },
];

export const CURRENT_ADVISOR_ID = 'ADV-1042';

export const DEFAULT_ADVISOR_PROFILE: AdvisorProfile = {
  name: 'Rohan Mehta',
  email: 'advisor@cibilon.in',
  mobile: '+91 98204 41207',
  dsaId: 'DSA-1042',
  agency: 'Mehta Financial Services',
  gstin: '27AAKCM4571R1ZP',
  address: '304, Sunbeam Chambers, Nariman Point',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400021',
  bankName: 'HDFC Bank',
  accountNumber: '50100294417832',
  ifsc: 'HDFC0000521',
  accountHolder: 'Mehta Financial Services',
  panNumber: 'AAKCM4571R',
  accountStatus: 'Active',
  photo: null,
};

/* ------------------------------------------------------------------ */
/* Application seeds                                                   */
/* ------------------------------------------------------------------ */

type Seed = {
  n: number;
  name: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  pincode: string;
  service: ServiceType;
  amount: number;
  status: ApplicationStatus;
  advisor: string;
  age: number;
  employment: 'Salaried' | 'Self Employed' | 'Business';
  income: number;
  org: string;
  lender: string;
  remarks: string;
};

const SEEDS: Seed[] = [
  { n: 1041, name: 'Kavita Deshmukh', mobile: '9820011245', email: 'kavita.d@gmail.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400058', service: 'Personal Loan', amount: 850000, status: 'Disbursed', advisor: 'ADV-1042', age: 62, employment: 'Salaried', income: 118000, org: 'Tata Consultancy Services', lender: 'HDFC Bank', remarks: 'Disbursed in full. Payout cycle closed for the month.' },
  { n: 1042, name: 'Imran Shaikh', mobile: '9702244518', email: 'imran.shaikh@outlook.com', city: 'Thane', state: 'Maharashtra', pincode: '400604', service: 'Business Loan', amount: 2500000, status: 'Completed', advisor: 'ADV-1042', age: 74, employment: 'Business', income: 340000, org: 'Shaikh Auto Spares', lender: 'Bajaj Finserv', remarks: 'File closed. Payout settled via NEFT.' },
  { n: 1043, name: 'Neha Agarwal', mobile: '9930112277', email: 'neha.agarwal@gmail.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400026', service: 'Home Loan', amount: 7500000, status: 'Submitted to Lender', advisor: 'ADV-1042', age: 21, employment: 'Salaried', income: 245000, org: 'Kotak Securities', lender: 'ICICI Bank', remarks: 'Logged in with ICICI. Technical valuation scheduled.' },
  { n: 1044, name: 'Sanjay Pawar', mobile: '9821567741', email: 'sanjay.pawar@gmail.com', city: 'Navi Mumbai', state: 'Maharashtra', pincode: '400703', service: 'Vehicle Loan', amount: 1200000, status: 'Approved', advisor: 'ADV-1042', age: 12, employment: 'Salaried', income: 96000, org: 'Reliance Industries', lender: 'Axis Bank', remarks: 'Sanction letter issued. Awaiting delivery order from dealer.' },
  { n: 1045, name: 'Farida Merchant', mobile: '9987441120', email: 'farida.m@yahoo.in', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', service: 'Loan Against Property', amount: 4500000, status: 'Documents Required', advisor: 'ADV-1042', age: 8, employment: 'Business', income: 285000, org: 'Merchant Exports LLP', lender: 'Tata Capital', remarks: 'Property chain documents and latest ITR pending from customer.' },
  { n: 1046, name: 'Rakesh Yadav', mobile: '9004112238', email: 'rakesh.yadav91@gmail.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400012', service: 'Personal Loan', amount: 450000, status: 'Processing', advisor: 'ADV-1042', age: 5, employment: 'Salaried', income: 62000, org: 'Blue Dart Express', lender: 'IDFC First Bank', remarks: 'Credit assessment in progress. CIBIL pulled at 741.' },
  { n: 1047, name: 'Anita Rane', mobile: '9820774411', email: 'anita.rane@gmail.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400016', service: 'Credit Card', amount: 0, status: 'Under Review', advisor: 'ADV-1042', age: 3, employment: 'Salaried', income: 88000, org: 'Godrej Properties', lender: 'HDFC Bank', remarks: 'Income documents received, under verification.' },
  { n: 1048, name: 'Prakash Menon', mobile: '9769112204', email: 'prakash.menon@gmail.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400071', service: 'Business Loan', amount: 1800000, status: 'Rejected', advisor: 'ADV-1042', age: 34, employment: 'Business', income: 155000, org: 'Menon Traders', lender: 'Yes Bank', remarks: 'Declined by lender — GST turnover inconsistent with declared income.' },
  { n: 1049, name: 'Sunita Bhatia', mobile: '9930447712', email: 'sunita.bhatia@gmail.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400053', service: 'Insurance', amount: 0, status: 'Disbursed', advisor: 'ADV-1042', age: 41, employment: 'Salaried', income: 74000, org: 'Bharat Petroleum', lender: 'HDFC Bank', remarks: 'Policy issued. Payout scheduled in next cycle.' },
  { n: 1050, name: 'Deepak Chauhan', mobile: '9820119955', email: 'deepak.chauhan@gmail.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400097', service: 'Personal Loan', amount: 300000, status: 'Submitted', advisor: 'ADV-1042', age: 1, employment: 'Salaried', income: 54000, org: 'Zomato', lender: 'No preference', remarks: '' },
  { n: 1051, name: 'Ritu Malhotra', mobile: '9821004477', email: 'ritu.malhotra@gmail.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400020', service: 'Home Loan', amount: 5200000, status: 'Additional Information Required', advisor: 'ADV-1042', age: 17, employment: 'Salaried', income: 168000, org: 'Accenture India', lender: 'State Bank of India', remarks: 'Lender has asked for co-applicant income proof and employer verification letter.' },
  { n: 1052, name: 'Ganesh Kamath', mobile: '9987001122', email: 'ganesh.kamath@gmail.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400028', service: 'Vehicle Loan', amount: 900000, status: 'Draft', advisor: 'ADV-1042', age: 0, employment: 'Self Employed', income: 92000, org: 'Kamath Consultancy', lender: 'No preference', remarks: '' },
  { n: 1053, name: 'Shalini Rao', mobile: '9945112200', email: 'shalini.rao@gmail.com', city: 'Bengaluru', state: 'Karnataka', pincode: '560034', service: 'Personal Loan', amount: 600000, status: 'Disbursed', advisor: 'ADV-1088', age: 55, employment: 'Salaried', income: 132000, org: 'Infosys', lender: 'Kotak Mahindra Bank', remarks: 'Disbursed. Payout raised.' },
  { n: 1054, name: 'Naveen Kumar', mobile: '9880114477', email: 'naveen.k@gmail.com', city: 'Bengaluru', state: 'Karnataka', pincode: '560076', service: 'Business Loan', amount: 3200000, status: 'Processing', advisor: 'ADV-1088', age: 9, employment: 'Business', income: 410000, org: 'NK Logistics', lender: 'Aditya Birla Finance', remarks: 'Banking analysis under way.' },
  { n: 1055, name: 'Lakshmi Venkatesh', mobile: '9900221144', email: 'lakshmi.v@gmail.com', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', service: 'Home Loan', amount: 9500000, status: 'Approved', advisor: 'ADV-1088', age: 26, employment: 'Salaried', income: 320000, org: 'Google India', lender: 'HDFC Bank', remarks: 'Sanctioned at 8.4%. Disbursement post registration.' },
  { n: 1056, name: 'Harpreet Kaur', mobile: '9811003366', email: 'harpreet.kaur@gmail.com', city: 'New Delhi', state: 'Delhi', pincode: '110024', service: 'Loan Against Property', amount: 6000000, status: 'Submitted to Lender', advisor: 'ADV-1113', age: 14, employment: 'Business', income: 380000, org: 'Kaur Textiles', lender: 'Tata Capital', remarks: 'Legal and technical initiated.' },
  { n: 1057, name: 'Mohit Bansal', mobile: '9818224400', email: 'mohit.bansal@gmail.com', city: 'New Delhi', state: 'Delhi', pincode: '110058', service: 'Credit Card', amount: 0, status: 'Completed', advisor: 'ADV-1113', age: 68, employment: 'Salaried', income: 105000, org: 'Deloitte India', lender: 'Axis Bank', remarks: 'Card delivered and activated. Payout settled.' },
  { n: 1058, name: 'Tanvi Sharma', mobile: '9910445511', email: 'tanvi.sharma@gmail.com', city: 'Gurugram', state: 'Haryana', pincode: '122002', service: 'Personal Loan', amount: 1100000, status: 'Documents Required', advisor: 'ADV-1113', age: 6, employment: 'Salaried', income: 148000, org: 'American Express', lender: 'ICICI Bank', remarks: 'Latest 3 salary slips are illegible — re-upload requested.' },
  { n: 1059, name: 'Amit Deshpande', mobile: '9021114488', email: 'amit.deshpande@gmail.com', city: 'Pune', state: 'Maharashtra', pincode: '411045', service: 'Vehicle Loan', amount: 1550000, status: 'Disbursed', advisor: 'ADV-1156', age: 38, employment: 'Salaried', income: 142000, org: 'Bajaj Auto', lender: 'Bajaj Finserv', remarks: 'Disbursed to dealer account.' },
  { n: 1060, name: 'Pooja Ghosh', mobile: '9822004411', email: 'pooja.ghosh@gmail.com', city: 'Pune', state: 'Maharashtra', pincode: '411014', service: 'Insurance', amount: 0, status: 'Under Review', advisor: 'ADV-1156', age: 4, employment: 'Salaried', income: 79000, org: 'Persistent Systems', lender: 'No preference', remarks: 'Medical underwriting pending.' },
  { n: 1061, name: 'Suresh Babu', mobile: '9959112200', email: 'suresh.babu@gmail.com', city: 'Hyderabad', state: 'Telangana', pincode: '500081', service: 'Business Loan', amount: 2100000, status: 'Rejected', advisor: 'ADV-1201', age: 52, employment: 'Business', income: 190000, org: 'Babu Enterprises', lender: 'Yes Bank', remarks: 'Rejected — existing overdue in bureau report.' },
  { n: 1062, name: 'Divya Prasad', mobile: '9948117733', email: 'divya.prasad@gmail.com', city: 'Hyderabad', state: 'Telangana', pincode: '500032', service: 'Home Loan', amount: 6800000, status: 'Processing', advisor: 'ADV-1201', age: 11, employment: 'Salaried', income: 210000, org: 'Microsoft India', lender: 'State Bank of India', remarks: 'File under credit appraisal.' },
  { n: 1063, name: 'Nilesh Patel', mobile: '8879004411', email: 'nilesh.patel@gmail.com', city: 'Ahmedabad', state: 'Gujarat', pincode: '380015', service: 'Loan Against Property', amount: 3800000, status: 'Submitted', advisor: 'ADV-1230', age: 2, employment: 'Business', income: 265000, org: 'Patel Ceramics', lender: 'Aditya Birla Finance', remarks: '' },
  { n: 1064, name: 'Reena Thakkar', mobile: '8866112244', email: 'reena.thakkar@gmail.com', city: 'Surat', state: 'Gujarat', pincode: '395007', service: 'Personal Loan', amount: 520000, status: 'Under Review', advisor: 'ADV-1230', age: 7, employment: 'Salaried', income: 71000, org: 'Reliance Retail', lender: 'IDFC First Bank', remarks: 'KYC verification in progress.' },
];

/* ------------------------------------------------------------------ */
/* Derivation helpers                                                  */
/* ------------------------------------------------------------------ */

export function computePayout(service: ServiceType, amount: number): number {
  const flat = FLAT_PAYOUTS[service];
  if (flat !== undefined) return flat;
  return Math.round((amount * PAYOUT_RATES[service]) / 100);
}

export function isLoanService(service: ServiceType | ''): boolean {
  return LOAN_SERVICES.includes(service as ServiceType);
}

const TERMINAL: ApplicationStatus[] = ['Disbursed', 'Completed'];

function buildEmployment(seed: Seed): EmploymentInfo {
  const salaried = seed.employment === 'Salaried';
  return {
    employmentType: seed.employment,
    monthlyIncome: String(seed.income),
    organisation: seed.org,
    experience: salaried ? String(3 + (seed.n % 9)) : String(5 + (seed.n % 12)),
    designation: salaried ? ['Manager', 'Senior Analyst', 'Team Lead', 'AVP'][seed.n % 4] : '',
    businessVintage: salaried ? '' : String(6 + (seed.n % 10)),
    businessType: salaried ? '' : ['Proprietorship', 'Partnership', 'Private Limited'][seed.n % 3],
    gstin: salaried ? '' : `27AA${seed.n}CM45${seed.n % 10}R1Z${seed.n % 9}`,
    natureOfWork: salaried ? '' : 'Trading & Distribution',
    existingLoans: seed.n % 3 === 0 ? 'Yes' : 'No',
    existingEmi: seed.n % 3 === 0 ? String(8000 + (seed.n % 7) * 2500) : '0',
    creditScore: String(690 + (seed.n % 12) * 10),
    bankName: ['HDFC Bank', 'ICICI Bank', 'Axis Bank', 'State Bank of India'][seed.n % 4],
    accountNumber: `50100${seed.n}44${seed.n % 100}`,
    ifsc: ['HDFC0000521', 'ICIC0000104', 'UTIB0001234', 'SBIN0011513'][seed.n % 4],
  };
}

function buildServiceDetails(seed: Seed): ServiceDetails {
  const loan = isLoanService(seed.service);
  return {
    service: seed.service,
    loanAmount: loan ? String(seed.amount) : '',
    tenure: loan ? String([36, 48, 60, 84, 120, 180, 240][seed.n % 7]) : '',
    purpose: loan
      ? ['Debt Consolidation', 'Home Renovation', 'Working Capital', 'Business Expansion', 'Property Purchase', 'Vehicle Purchase'][seed.n % 6]
      : '',
    preferredLender: seed.lender,
    cardCategory: seed.service === 'Credit Card' ? 'Premium Rewards' : '',
    existingCards: seed.service === 'Credit Card' ? String(seed.n % 3) : '',
    insuranceType: seed.service === 'Insurance' ? 'Term Life Insurance' : '',
    sumAssured: seed.service === 'Insurance' ? '10000000' : '',
    premiumFrequency: seed.service === 'Insurance' ? 'Annual' : '',
    serviceNotes: '',
  };
}

function docStatusFor(appStatus: ApplicationStatus, index: number): DocumentStatus {
  if (appStatus === 'Draft') return index < 2 ? 'Uploaded' : 'Pending';
  if (appStatus === 'Submitted') return 'Uploaded';
  if (appStatus === 'Under Review') return index % 3 === 0 ? 'Verified' : 'Under Verification';
  if (appStatus === 'Documents Required') {
    if (index === 3) return 'Re-upload Required';
    if (index === 4) return 'Rejected';
    return index % 2 === 0 ? 'Verified' : 'Uploaded';
  }
  if (appStatus === 'Additional Information Required') {
    return index === 2 ? 'Re-upload Required' : 'Verified';
  }
  if (appStatus === 'Rejected') return index % 4 === 0 ? 'Rejected' : 'Verified';
  return 'Verified';
}

const DOC_REMARKS: Partial<Record<DocumentStatus, string>> = {
  'Re-upload Required': 'Scan is not legible. Please upload a clearer colour copy.',
  Rejected: 'Document does not match the applicant details on record.',
  'Under Verification': 'With the verification desk.',
};

function buildDocuments(seed: Seed, applicationId: string): AppDocument[] {
  const checklist = DOCUMENT_CHECKLIST[seed.service];
  return checklist.map((entry, index) => {
    const status = docStatusFor(seed.status, index);
    const uploaded = status !== 'Pending';
    const ext = index % 4 === 0 ? 'pdf' : index % 4 === 1 ? 'jpg' : index % 4 === 2 ? 'pdf' : 'png';
    return {
      id: `${applicationId}-DOC${index + 1}`,
      applicationId,
      name: entry.name,
      fileName: uploaded
        ? `${entry.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')}-${seed.n}.${ext}`
        : '',
      fileType: ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : 'png'}`,
      size: uploaded ? 180_000 + ((seed.n * (index + 3)) % 1_600_000) : 0,
      // Documents are attached alongside the application, so they share its date.
      uploadedAt: uploaded ? daysAgo(seed.age, 9 + (index % 9)) : null,
      status,
      remarks: DOC_REMARKS[status] ?? '',
      required: entry.required,
    };
  });
}

const STAGE_NOTES: Record<string, string> = {
  Submitted: 'Application received from advisor and queued for the verification desk.',
  'Under Review': 'KYC and income documents picked up for verification.',
  Processing: 'Credit assessment and bureau check completed. File being prepared for login.',
  'Submitted to Lender': 'File logged in with the lender. Awaiting their credit decision.',
  Approved: 'Lender has issued the sanction.',
  Disbursed: 'Amount disbursed to the customer account.',
  Completed: 'Payout generated and file closed.',
};

function buildTimeline(seed: Seed, applicationId: string): TimelineEvent[] {
  if (seed.status === 'Draft') return [];

  const reached: ApplicationStatus[] = [];
  const anchorIndex = PIPELINE.indexOf(
    seed.status === 'Documents Required'
      ? 'Under Review'
      : seed.status === 'Additional Information Required'
        ? 'Submitted to Lender'
        : seed.status === 'Rejected'
          ? 'Submitted to Lender'
          : seed.status,
  );
  for (let i = 0; i <= anchorIndex; i += 1) reached.push(PIPELINE[i]);

  const span = Math.max(1, seed.age);
  const events: TimelineEvent[] = reached.map((stage, i) => ({
    id: `${applicationId}-TL${i + 1}`,
    stage,
    label: PIPELINE_LABELS[stage] ?? stage,
    note: STAGE_NOTES[stage] ?? '',
    actor: i === 0 ? 'Advisor' : 'Cibilon Operations',
    at: daysAgo(Math.max(0, span - Math.round((span / (reached.length || 1)) * i)), 10 + i),
  }));

  if (seed.status === 'Documents Required' || seed.status === 'Additional Information Required') {
    events.push({
      id: `${applicationId}-TLX`,
      stage: seed.status,
      label: seed.status,
      note: seed.remarks,
      actor: 'Cibilon Operations',
      at: daysAgo(Math.max(0, Math.round(seed.age / 3)), 15),
    });
  }
  if (seed.status === 'Rejected') {
    events.push({
      id: `${applicationId}-TLR`,
      stage: 'Rejected',
      label: 'Rejected',
      note: seed.remarks,
      actor: 'Lender',
      at: daysAgo(Math.max(0, Math.round(seed.age / 4)), 16),
    });
  }
  return events;
}

const REQUIRED_ACTIONS: Partial<Record<ApplicationStatus, string[]>> = {
  'Documents Required': [
    'Re-upload the documents flagged by the verification desk',
    'Confirm the customer’s current residence address',
  ],
  'Additional Information Required': [
    'Share co-applicant income proof',
    'Upload employer verification letter',
  ],
  Draft: ['Complete the remaining steps and submit the application'],
};

/** Keeps the generated gender consistent with the seeded customer names. */
const FEMALE_FIRST_NAMES = new Set([
  'Kavita',
  'Neha',
  'Farida',
  'Anita',
  'Sunita',
  'Ritu',
  'Shalini',
  'Lakshmi',
  'Harpreet',
  'Tanvi',
  'Pooja',
  'Divya',
  'Reena',
]);

/** Where a lead sits, inferred from how far its application has travelled. */
export function leadStageFor(status: ApplicationStatus): LeadStage {
  if (status === 'Draft') return 'New';
  if (status === 'Submitted') return 'Contacted';
  if (status === 'Under Review') return 'Qualified';
  if (status === 'Documents Required' || status === 'Additional Information Required')
    return 'Documents Pending';
  if (status === 'Rejected') return 'Dropped';
  return 'Converted';
}

function buildApplication(seed: Seed): Application {
  const id = `APP${seed.n}`;
  const advisor = ADVISORS.find((a) => a.id === seed.advisor)!;
  const staff = ASSIGNABLE_STAFF[seed.n % ASSIGNABLE_STAFF.length];
  const timeline = buildTimeline(seed, id);
  const submittedAt = seed.status === 'Draft' ? null : daysAgo(seed.age, 10);
  const updatedAt = timeline.length ? timeline[timeline.length - 1].at : daysAgo(seed.age, 10);

  return {
    id,
    leadId: `LD-${seed.n}`,
    advisorId: advisor.id,
    advisorName: advisor.name,
    customer: {
      fullName: seed.name,
      mobile: seed.mobile,
      email: seed.email,
      dob: `19${70 + (seed.n % 25)}-0${1 + (seed.n % 9)}-1${seed.n % 9}`,
      gender: FEMALE_FIRST_NAMES.has(seed.name.split(' ')[0]) ? 'Female' : 'Male',
      pan: `A${String.fromCharCode(65 + (seed.n % 26))}KPM${seed.n}${String.fromCharCode(65 + (seed.n % 20))}`,
      aadhaar: `${2000 + (seed.n % 8000)} ${1000 + (seed.n % 9000)} ${4000 + (seed.n % 5000)}`,
      address: `${seed.n % 900}, ${['Shanti Nagar', 'Green Park', 'Rose Villa', 'Sunrise Apartments', 'Lake View Residency'][seed.n % 5]}`,
      city: seed.city,
      state: seed.state,
      pincode: seed.pincode,
    },
    employment: buildEmployment(seed),
    serviceDetails: buildServiceDetails(seed),
    service: seed.service,
    loanAmount: seed.amount,
    status: seed.status,
    leadStage: leadStageFor(seed.status),
    processingStage:
      seed.status === 'Draft'
        ? 'Not started'
        : TERMINAL.includes(seed.status)
          ? 'Closed'
          : ['Verification desk', 'Credit team', 'Lender desk', 'Ops review'][seed.n % 4],
    assignedTo: seed.status === 'Draft' ? '—' : staff.name,
    assignedStaffId: seed.status === 'Draft' ? null : staff.id,
    createdAt: daysAgo(seed.age + 1, 9),
    updatedAt,
    submittedAt,
    expectedPayout: computePayout(seed.service, seed.amount),
    adminRemarks: seed.remarks,
    requiredActions: REQUIRED_ACTIONS[seed.status] ?? [],
    timeline,
    lender: seed.lender,
    source: ['Referral', 'Walk-in', 'Existing customer', 'Cold call', 'Website enquiry'][seed.n % 5],
  };
}

export const SEED_APPLICATIONS: Application[] = SEEDS.map(buildApplication);

export const SEED_DOCUMENTS: AppDocument[] = SEEDS.flatMap((seed) =>
  buildDocuments(seed, `APP${seed.n}`),
);

/* ------------------------------------------------------------------ */
/* Payouts                                                             */
/* ------------------------------------------------------------------ */

export const SEED_PAYOUTS: Payout[] = SEEDS.filter((s) =>
  ['Disbursed', 'Completed'].includes(s.status),
).map((seed, index) => {
  const completed = seed.status === 'Completed';
  const disbursedOn = daysAgo(Math.max(1, Math.round(seed.age / 2)), 12);
  return {
    id: `PO-${seed.n}`,
    applicationId: `APP${seed.n}`,
    advisorId: seed.advisor,
    customerName: seed.name,
    service: seed.service,
    loanAmount: seed.amount,
    payoutAmount: computePayout(seed.service, seed.amount),
    estimated: false,
    payoutRate: FLAT_PAYOUTS[seed.service] !== undefined ? 0 : PAYOUT_RATES[seed.service],
    disbursementDate: disbursedOn,
    // Alternate the unpaid rows so every payout state is represented in the demo.
    status: completed ? 'Paid' : index % 2 === 0 ? 'Processing' : 'Pending',
    paymentDate: completed ? daysAgo(Math.max(0, Math.round(seed.age / 4)), 12) : null,
    utr: completed ? `UTR${seed.n}9${seed.n % 100}4471` : null,
  };
});

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'NT-01',
    kind: 'document',
    title: 'Documents required for APP1045',
    body: 'Property chain documents and the latest ITR are pending for Farida Merchant.',
    applicationId: 'APP1045',
    audience: 'advisor',
    at: daysAgo(0, 9),
    read: false,
  },
  {
    id: 'NT-02',
    kind: 'status',
    title: 'APP1046 has moved to Processing',
    body: 'Credit assessment has started for Rakesh Yadav’s personal loan.',
    applicationId: 'APP1046',
    audience: 'advisor',
    at: daysAgo(0, 14),
    read: false,
  },
  {
    id: 'NT-03',
    kind: 'alert',
    title: 'Your submitted document was rejected',
    body: 'Bank Statements for APP1045 did not match the applicant details on record.',
    applicationId: 'APP1045',
    audience: 'advisor',
    at: daysAgo(1, 16),
    read: false,
  },
  {
    id: 'NT-04',
    kind: 'approval',
    title: 'APP1044 has been approved',
    body: 'Axis Bank has sanctioned ₹12,00,000 for Sanjay Pawar.',
    applicationId: 'APP1044',
    audience: 'advisor',
    at: daysAgo(2, 11),
    read: true,
  },
  {
    id: 'NT-05',
    kind: 'payout',
    title: 'Payout generated for APP1042',
    body: '₹45,000 has been credited against Imran Shaikh’s business loan.',
    applicationId: 'APP1042',
    audience: 'advisor',
    at: daysAgo(4, 13),
    read: true,
  },
  {
    id: 'NT-06',
    kind: 'status',
    title: 'APP1051 needs additional information',
    body: 'SBI has requested co-applicant income proof for Ritu Malhotra.',
    applicationId: 'APP1051',
    audience: 'advisor',
    at: daysAgo(5, 10),
    read: true,
  },
  {
    id: 'NT-07',
    kind: 'alert',
    title: '4 applications awaiting review',
    body: 'New submissions are queued at the verification desk.',
    audience: 'admin',
    at: daysAgo(0, 8),
    read: false,
  },
  {
    id: 'NT-08',
    kind: 'payout',
    title: '6 payouts pending release',
    body: 'Disbursed files are waiting for the payout run this cycle.',
    audience: 'admin',
    at: daysAgo(1, 12),
    read: false,
  },
  {
    id: 'NT-09',
    kind: 'document',
    title: 'Re-uploaded document received for APP1058',
    body: 'Tanvi Sharma’s salary slips have been re-submitted by DSA-1113.',
    applicationId: 'APP1058',
    audience: 'admin',
    at: daysAgo(2, 15),
    read: true,
  },
];

/* ------------------------------------------------------------------ */
/* Chart series                                                        */
/* ------------------------------------------------------------------ */

export const MONTHLY_TREND = [
  { month: 'Mar', submitted: 6, disbursed: 3, payout: 118000 },
  { month: 'Apr', submitted: 9, disbursed: 4, payout: 162000 },
  { month: 'May', submitted: 7, disbursed: 5, payout: 205000 },
  { month: 'Jun', submitted: 12, disbursed: 6, payout: 248000 },
  { month: 'Jul', submitted: 10, disbursed: 7, payout: 291000 },
  { month: 'Aug', submitted: 14, disbursed: 8, payout: 336000 },
];
