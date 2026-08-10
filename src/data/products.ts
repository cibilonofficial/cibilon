import { DOCUMENT_CHECKLIST, FLAT_PAYOUTS, PAYOUT_RATES } from '@/lib/constants';
import type { ProductConfig, ServiceType } from '@/types';

type Overrides = Omit<ProductConfig, 'service' | 'documents' | 'payoutRate' | 'flatPayout'>;

const CONFIG: Record<ServiceType, Overrides> = {
  'Personal Loan': {
    active: true,
    tagline: 'Unsecured funding for salaried and self-employed customers.',
    minAmount: 50_000,
    maxAmount: 4_000_000,
    minTenure: 12,
    maxTenure: 72,
    interestFrom: 10.5,
    interestTo: 18,
    eligibility: [
      'Age between 21 and 60 years',
      'Net monthly income of ₹25,000 or higher',
      'Bureau score of 700+ with no current overdue',
      'Minimum 12 months in the current job',
    ],
    lenderIds: ['LN-01', 'LN-02', 'LN-03', 'LN-05', 'LN-06', 'LN-08', 'LN-10'],
  },
  'Business Loan': {
    active: true,
    tagline: 'Working capital and expansion funding against business turnover.',
    minAmount: 200_000,
    maxAmount: 7_500_000,
    minTenure: 12,
    maxTenure: 60,
    interestFrom: 12,
    interestTo: 22,
    eligibility: [
      'Business vintage of at least 3 years',
      'Annual turnover of ₹40L or higher',
      'GST registration and 12 months of banking',
      'Filed ITR for the last 2 financial years',
    ],
    lenderIds: ['LN-03', 'LN-05', 'LN-06', 'LN-07', 'LN-09', 'LN-10'],
  },
  'Home Loan': {
    active: true,
    tagline: 'Purchase, construction and balance-transfer home finance.',
    minAmount: 500_000,
    maxAmount: 100_000_000,
    minTenure: 60,
    maxTenure: 360,
    interestFrom: 8.35,
    interestTo: 11,
    eligibility: [
      'Age between 23 and 65 years at loan maturity',
      'Clear and marketable title on the property',
      'FOIR within 55% of net income',
      'Approved project or a lender-cleared technical valuation',
    ],
    lenderIds: ['LN-01', 'LN-02', 'LN-04'],
  },
  'Loan Against Property': {
    active: true,
    tagline: 'Secured funding against residential or commercial property.',
    minAmount: 1_000_000,
    maxAmount: 50_000_000,
    minTenure: 60,
    maxTenure: 180,
    interestFrom: 9.25,
    interestTo: 14.5,
    eligibility: [
      'Self-occupied or rented property with a clear chain of title',
      'LTV capped at 65% of the market value',
      'Business vintage of 3 years for self-employed applicants',
      'Property must be free of any existing lien',
    ],
    lenderIds: ['LN-02', 'LN-04', 'LN-06', 'LN-07', 'LN-10'],
  },
  'Vehicle Loan': {
    active: true,
    tagline: 'New and used vehicle finance with dealer tie-ups.',
    minAmount: 100_000,
    maxAmount: 5_000_000,
    minTenure: 12,
    maxTenure: 84,
    interestFrom: 8.75,
    interestTo: 15,
    eligibility: [
      'Valid driving licence for the applicant',
      'Proforma invoice from an authorised dealer',
      'Margin money of 10–20% depending on the model',
      'Bureau score of 680+',
    ],
    lenderIds: ['LN-01', 'LN-03', 'LN-04', 'LN-06', 'LN-08'],
  },
  'Credit Card': {
    active: true,
    tagline: 'Lifestyle, rewards and business cards from partner issuers.',
    minAmount: 0,
    maxAmount: 0,
    minTenure: 0,
    maxTenure: 0,
    interestFrom: 0,
    interestTo: 0,
    eligibility: [
      'Net monthly income of ₹30,000 or higher',
      'Bureau score of 720+ for premium variants',
      'No card write-off or settlement in the bureau history',
    ],
    lenderIds: ['LN-01', 'LN-02', 'LN-03', 'LN-05', 'LN-08', 'LN-12'],
  },
  Insurance: {
    active: true,
    tagline: 'Term, health and general insurance distribution.',
    minAmount: 0,
    maxAmount: 0,
    minTenure: 0,
    maxTenure: 0,
    interestFrom: 0,
    interestTo: 0,
    eligibility: [
      'Age between 18 and 65 years',
      'Medical underwriting above ₹50L sum assured',
      'Income proof for sum assured above 20x annual income',
    ],
    lenderIds: ['LN-01', 'LN-11'],
  },
  'Other Financial Services': {
    active: false,
    tagline: 'Bespoke requirements routed to the partnerships desk.',
    minAmount: 0,
    maxAmount: 0,
    minTenure: 0,
    maxTenure: 0,
    interestFrom: 0,
    interestTo: 0,
    eligibility: ['Case-by-case assessment by the partnerships team'],
    lenderIds: ['LN-07', 'LN-10'],
  },
};

/**
 * Product catalogue. The document checklist and payout economics are read
 * from the same constants the application flow uses, so editing a product
 * here never drifts from what the advisor is asked to upload.
 */
export const SEED_PRODUCTS: ProductConfig[] = (
  Object.keys(CONFIG) as ServiceType[]
).map((service) => ({
  service,
  ...CONFIG[service],
  payoutRate: PAYOUT_RATES[service],
  flatPayout: FLAT_PAYOUTS[service] ?? null,
  documents: DOCUMENT_CHECKLIST[service].map((d) => ({ ...d })),
}));
