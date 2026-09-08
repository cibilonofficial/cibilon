export type DocumentDomain = 'loans' | 'insurance';

export interface DocumentItem {
  id: string;
  name: string;
  mandatory?: boolean;
  notes?: string;
  format?: string; // e.g. '1 PDF Bundle', 'Hardcopy / Scan', 'Excel', etc.
}

export interface DocumentSection {
  title: string;
  badge?: string;
  description?: string;
  items: DocumentItem[];
}

export interface DocumentVariant {
  id: string;
  title: string;
  subtitle?: string;
  sections: DocumentSection[];
  specialInstructions?: string[];
}

export interface DocumentCategoryConfig {
  id: string;
  domain: DocumentDomain;
  name: string;
  iconName: string; // lucide icon identifier
  tagline: string;
  variants: DocumentVariant[];
}

export const DOCUMENTATION_DATA: DocumentCategoryConfig[] = [
  // -------------------------------------------------------------
  // 1. PERSONAL LOAN
  // -------------------------------------------------------------
  {
    id: 'personal-loan',
    domain: 'loans',
    name: 'Personal Loan',
    iconName: 'Banknote',
    tagline: 'Document checklist for salaried and self-employed personal-loan applicants.',
    variants: [
      {
        id: 'salaried',
        title: 'Salaried Individual',
        subtitle: 'Standard requirements for salaried employees with monthly salary credit',
        sections: [
          {
            title: 'Identity & KYC',
            badge: 'Mandatory',
            items: [
              { id: 'pl-pan', name: 'PAN Card', mandatory: true },
              { id: 'pl-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'pl-address', name: 'Address Proof (Own House Proof / Gas Bill / Electricity Bill)', mandatory: true, notes: 'Electricity bill or Gas bill showing applicant residence' },
              { id: 'pl-empid', name: 'Employee ID Card', mandatory: false },
              { id: 'pl-mobile', name: 'Aadhaar-linked Mobile Number', mandatory: false },
              { id: 'pl-contact-mobile', name: 'Mobile Number', mandatory: false },
              { id: 'pl-personal-email', name: 'Personal Email ID', mandatory: false },
              { id: 'pl-official-email', name: 'Official Email ID', mandatory: false },
            ],
          },
          {
            title: 'Income & Banking',
            badge: 'Financials',
            items: [
              { id: 'pl-bank', name: '6 Months Bank Statement', mandatory: false, notes: 'Must clearly reflect monthly salary credits from employer' },
              { id: 'pl-payslips', name: '3 Months Latest Pay Slips', mandatory: false },
            ],
          },
        ],
      },
      {
        id: 'self-employed',
        title: 'Self Employed Individual',
        subtitle: 'Requirements for business owners and self-employed professionals',
        sections: [
          {
            title: 'Identity & KYC',
            badge: 'Mandatory',
            items: [
              { id: 'pl-se-pan', name: 'PAN Card', mandatory: true },
              { id: 'pl-se-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'pl-se-address', name: 'Address Proof (Residence / Utility Bill)', mandatory: true },
              { id: 'pl-se-photo', name: 'Passport Size Photograph', mandatory: false },
              { id: 'pl-se-mobile', name: 'Aadhaar-linked Mobile Number', mandatory: false },
              { id: 'pl-se-email', name: 'Personal Email ID', mandatory: false },
            ],
          },
          {
            title: 'Business & Financials',
            badge: 'Financials',
            items: [
              { id: 'pl-se-bank', name: 'Latest 1 Year Bank Statement of All Accounts', mandatory: false },
              { id: 'pl-se-itr', name: 'Latest 3 Years IT Returns (ITR)', mandatory: false },
              { id: 'pl-se-business', name: 'Business Registration Proof (GST / Udyam / Licence)', mandatory: false },
              { id: 'pl-se-financials', name: 'Profit & Loss and Balance Sheet', mandatory: false, notes: 'Latest available financial statements' },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------
  // 2. BUSINESS LOAN
  // -------------------------------------------------------------
  {
    id: 'business-loan',
    domain: 'loans',
    name: 'Business Loan',
    iconName: 'Building2',
    tagline: 'Comprehensive documentation according to business entity constitution.',
    variants: [
      {
        id: 'proprietorship',
        title: 'Proprietorship',
        subtitle: 'For sole proprietorship businesses and individual traders',
        sections: [
          {
            title: 'Applicant / Co-applicant',
            badge: 'Mandatory',
            items: [
              { id: 'bl-prop-pan', name: 'PAN Card', mandatory: true },
              { id: 'bl-prop-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'bl-prop-addr', name: 'Residence Proof', mandatory: true, notes: 'Rental agreement, utility bill, or tax receipt' },
              { id: 'bl-prop-photo', name: 'Photograph of Applicant and Co-applicant', mandatory: false },
              { id: 'bl-prop-mobile', name: 'Mobile Number of Applicant and Co-applicant', mandatory: false },
              { id: 'bl-prop-email', name: 'Email ID of Applicant and Co-applicant', mandatory: false },
              { id: 'bl-prop-house', name: 'Own House Proof', mandatory: false },
            ],
          },
          {
            title: 'Business Registration & Constitution',
            badge: 'Business Proof',
            items: [
              { id: 'bl-prop-gst-reg', name: 'Company Registration Copy (GST)', mandatory: false },
              { id: 'bl-prop-company-address', name: 'Company Address Proof', mandatory: false },
              { id: 'bl-prop-udyam', name: 'Udyam Certificate (MSME)', mandatory: false },
              { id: 'bl-prop-labour', name: 'Labour Licence / Shop & Establishment Certificate', mandatory: false },
            ],
          },
          {
            title: 'Financials & Tax Filings',
            badge: 'Financials',
            items: [
              { id: 'bl-prop-itr', name: 'Latest 3 Years IT Returns (ITR)', mandatory: false, notes: 'With computation of income, balance sheet & P&L' },
              { id: 'bl-prop-bank', name: 'Latest 1 Year Bank Statement of All Accounts', mandatory: false, notes: 'Current account & active savings accounts' },
              { id: 'bl-prop-gst-ret', name: 'Latest 1 Year GST Returns (GSTR-3B / GSTR-1)', mandatory: false },
              { id: 'bl-prop-loans', name: 'Existing Loan Details in Excel Sheet', mandatory: false, notes: 'Sanction letters and amortization schedules' },
              { id: 'bl-prop-od', name: 'OD Sanction Letter for OD Banking', mandatory: false, notes: 'Required if operating an existing Cash Credit / Overdraft facility' },
            ],
          },
        ],
      },
      {
        id: 'partnership',
        title: 'Partnership Firm',
        subtitle: 'For registered partnership firms and LLPs',
        sections: [
          {
            title: 'Firm & Partners KYC',
            badge: 'Mandatory',
            items: [
              { id: 'bl-part-pan', name: 'Company / Firm PAN Card', mandatory: true },
              { id: 'bl-part-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'bl-part-addr', name: 'Address Proof (Company Address Proof / Partner Residence Proof)', mandatory: true },
              { id: 'bl-part-51', name: 'KYC Documents of 51%+ Shareholding Partners', mandatory: false, notes: 'Must cover partners holding controlling stake' },
              { id: 'bl-part-photo', name: 'Passport Size Photograph', mandatory: false },
            ],
          },
          {
            title: 'Firm Registration & Legal Documents',
            badge: 'Constitutional',
            items: [
              { id: 'bl-part-deed', name: 'Partnership Deed (Registered / Notarized)', mandatory: false },
              { id: 'bl-part-gst-reg', name: 'Company Registration Copy (GST Certificate)', mandatory: false },
              { id: 'bl-part-udyam', name: 'Udyam Certificate', mandatory: false },
            ],
          },
          {
            title: 'Financials & Tax Filings',
            badge: 'Financials',
            items: [
              { id: 'bl-part-itr', name: 'Latest 3 Years IT Returns (Firm & Partners)', mandatory: false, notes: 'Complete with computation, balance sheet and P&L' },
              { id: 'bl-part-bank', name: 'Latest 1 Year Bank Statement of All Accounts', mandatory: false, notes: 'Firm current accounts and main partner accounts' },
              { id: 'bl-part-gst-ret', name: 'Latest 1 Year GST Returns', mandatory: false },
              { id: 'bl-part-loans', name: 'Existing Loan Details in Excel Sheet', mandatory: false },
              { id: 'bl-part-od', name: 'OD Sanction Letter for OD Banking', mandatory: false },
            ],
          },
        ],
      },
      {
        id: 'pvt-ltd',
        title: 'Private Limited Company',
        subtitle: 'For Pvt Ltd, Public Ltd, and corporate entities',
        sections: [
          {
            title: 'Corporate & Directors KYC',
            badge: 'Mandatory',
            items: [
              { id: 'bl-pvt-pan', name: 'Company PAN Card', mandatory: true },
              { id: 'bl-pvt-aadhaar', name: 'Director Aadhaar Card', mandatory: true },
              { id: 'bl-pvt-addr', name: 'Address Proof (Company Address Proof / Director Residence Proof)', mandatory: true },
              { id: 'bl-pvt-51', name: 'KYC Documents of 51%+ Shareholding Promoters / Directors', mandatory: false },
              { id: 'bl-pvt-photo', name: 'Passport Size Photograph', mandatory: false },
            ],
          },
          {
            title: 'Corporate Incorporation & Statutory',
            badge: 'Corporate',
            items: [
              { id: 'bl-pvt-reg', name: 'Company Registration Copy (GST & Certificate of Incorporation)', mandatory: false },
              { id: 'bl-pvt-moa', name: 'MOA (Memorandum of Association)', mandatory: false },
              { id: 'bl-pvt-aoa', name: 'AOA (Articles of Association)', mandatory: false },
              { id: 'bl-pvt-udyam', name: 'Udyam Certificate', mandatory: false },
            ],
          },
          {
            title: 'Corporate Financials & Audits',
            badge: 'Financials',
            items: [
              { id: 'bl-pvt-itr', name: 'Latest 3 Years IT Returns', mandatory: false, notes: 'Assessment Years 2022-2023 & 2023-2024 onwards' },
              { id: 'bl-pvt-bank', name: 'Latest 1 Year Bank Statement of All Accounts', mandatory: false, notes: 'Operating accounts, escrow, and current accounts' },
              { id: 'bl-pvt-gst-ret', name: 'Latest 1 Year GST Returns', mandatory: false },
              { id: 'bl-pvt-loans', name: 'Existing Loan Details in Excel Sheet', mandatory: false },
              { id: 'bl-pvt-od', name: 'OD Sanction Letter for OD Banking', mandatory: false },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------
  // 3. HOME LOAN
  // -------------------------------------------------------------
  {
    id: 'home-loan',
    domain: 'loans',
    name: 'Home Loan',
    iconName: 'Home',
    tagline: 'Complete checklist for home purchases, construction, and transfers.',
    variants: [
      {
        id: 'salaried',
        title: 'Salaried Applicant',
        subtitle: 'For salaried employees purchasing or constructing residential property',
        sections: [
          {
            title: 'Applicant KYC',
            badge: 'Mandatory',
            items: [
              { id: 'hl-sal-pan', name: 'PAN Card', mandatory: true },
              { id: 'hl-sal-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'hl-sal-addr', name: 'Address Proof (Current Residence Proof / Utility Bill)', mandatory: true },
              { id: 'hl-sal-photo', name: 'Passport Size Photograph', mandatory: false },
            ],
          },
          {
            title: 'Income & Financials',
            badge: 'Financials',
            items: [
              { id: 'hl-sal-bank', name: '1 Year Bank Statement with Salary Credited', mandatory: false },
              { id: 'hl-sal-pay', name: '6 Months Pay Slips', mandatory: false },
              { id: 'hl-sal-form16', name: 'FORM 16 (Last 2-3 Years)', mandatory: false },
              { id: 'hl-sal-itr', name: 'Latest 3 Years Tax Returns or Form 26AS', mandatory: false },
              { id: 'hl-sal-cheque', name: '1 Cheque for Login / Processing Fee', mandatory: false },
            ],
          },
          {
            title: 'Co-Applicant KYC & Income',
            badge: 'Co-Applicant',
            items: [
              { id: 'hl-sal-co-pan', name: 'Co-Applicant PAN Card', mandatory: false },
              { id: 'hl-sal-co-aadhaar', name: 'Co-Applicant Aadhaar Card', mandatory: false },
              { id: 'hl-sal-co-photo', name: 'Co-Applicant Passport Size Photograph', mandatory: false },
              { id: 'hl-sal-co-bank', name: 'Co-Applicant 1 Year Bank Statement', mandatory: false },
            ],
          },
          {
            title: 'Property Legal & Technical Documents',
            badge: 'Property',
            items: [
              { id: 'hl-sal-prop-sale', name: 'Agreement of Sale', mandatory: false },
              { id: 'hl-sal-prop-link', name: '15 Years Link Documents', mandatory: false, notes: 'Unbroken chain of title deeds for 15 years' },
              { id: 'hl-sal-prop-plan', name: 'Sanctioned Plan Copy', mandatory: false },
              { id: 'hl-sal-prop-docs', name: 'Title Deed & Property Ownership Documents', mandatory: false },
              { id: 'hl-sal-prop-ec', name: 'EC (Encumbrance Certificate) 20 Years Till Date', mandatory: false, notes: 'Non-encumbrance certificate covering 20 years' },
              { id: 'hl-sal-prop-tax', name: 'Property Tax Receipts (Latest 3 Years)', mandatory: false },
            ],
          },
        ],
      },
      {
        id: 'self-employed',
        title: 'Self Employed Applicant',
        subtitle: 'For business owners, traders, and self-employed professionals',
        sections: [
          {
            title: 'Applicant KYC & Business',
            badge: 'Mandatory',
            items: [
              { id: 'hl-se-pan', name: 'PAN Card', mandatory: true },
              { id: 'hl-se-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'hl-se-addr', name: 'Address Proof / Business Premises Proof', mandatory: true },
              { id: 'hl-se-photo', name: 'Passport Size Photograph', mandatory: false },
              { id: 'hl-se-bank', name: '1 Year Bank Statement (CA & SB)', mandatory: false, notes: 'Both Current Account and Savings Bank accounts' },
              { id: 'hl-se-biz', name: 'Business Proof (GST / Registration)', mandatory: false },
              { id: 'hl-se-itr', name: '3 Years ITR, P&L & Balance Sheet with CA Attestation', mandatory: false, notes: 'Audited financials with CA seal and signature' },
            ],
          },
          {
            title: 'Co-Applicant Documents',
            badge: 'Co-Applicant',
            items: [
              { id: 'hl-se-co-pan', name: 'Co-Applicant PAN Card', mandatory: false },
              { id: 'hl-se-co-aadhaar', name: 'Co-Applicant Aadhaar Card', mandatory: false },
              { id: 'hl-se-co-photo', name: 'Co-Applicant Photograph', mandatory: false },
              { id: 'hl-se-co-bank', name: 'Co-Applicant 1 Year Bank Statement', mandatory: false },
            ],
          },
          {
            title: 'Property Documents',
            badge: 'Property',
            items: [
              { id: 'hl-se-prop-sale', name: 'Agreement of Sale', mandatory: false },
              { id: 'hl-se-prop-link', name: '13 Years Link Documents', mandatory: false, notes: 'Link title deeds covering at least 13 years' },
              { id: 'hl-se-prop-plan', name: 'Plan Copy', mandatory: false },
              { id: 'hl-se-prop-docs', name: 'Property Documents & Title Deed', mandatory: false },
              { id: 'hl-se-prop-ec', name: 'EC Document (Encumbrance Certificate)', mandatory: false },
              { id: 'hl-se-prop-tax', name: 'Recent Property Tax Receipt', mandatory: false },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------
  // 4. LOAN AGAINST PROPERTY (LAP)
  // -------------------------------------------------------------
  {
    id: 'lap',
    domain: 'loans',
    name: 'Loan Against Property (LAP)',
    iconName: 'ShieldCheck',
    tagline: 'Mortgage loan checklist for Salaried and Self-Employed Non-Professionals (SENP).',
    variants: [
      {
        id: 'salaried',
        title: 'Salaried Checklist',
        subtitle: 'For salaried borrowers mortgaging residential or commercial property',
        sections: [
          {
            title: 'Applicant KYC',
            badge: 'Mandatory',
            items: [
              { id: 'lap-sal-pan', name: 'PAN Card', mandatory: true },
              { id: 'lap-sal-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'lap-sal-addr', name: 'Address Proof (Residence / Utility Bill)', mandatory: true },
              { id: 'lap-sal-photo', name: 'Photograph', mandatory: false },
              { id: 'lap-sal-bank', name: '1 Year Bank Statement with Salary Credited', mandatory: false },
              { id: 'lap-sal-payslips', name: '6 Months Pay Slips', mandatory: false },
              { id: 'lap-sal-form16', name: 'FORM 16', mandatory: false },
              { id: 'lap-sal-itr', name: 'Latest 3 Years Tax Returns or Form 26AS', mandatory: false },
              { id: 'lap-sal-cheque', name: '1 Cheque for Login', mandatory: false },
            ],
          },
          {
            title: 'Co-Applicant Documents',
            badge: 'Co-Applicant',
            items: [
              { id: 'lap-sal-co-pan', name: 'Co-Applicant PAN Card', mandatory: false },
              { id: 'lap-sal-co-aadhaar', name: 'Co-Applicant Aadhaar Card', mandatory: false },
              { id: 'lap-sal-co-photo', name: 'Co-Applicant Photograph', mandatory: false },
              { id: 'lap-sal-co-bank', name: 'Co-Applicant 1 Year Bank Statement', mandatory: false },
            ],
          },
          {
            title: 'Property Documents',
            badge: 'Property',
            items: [
              { id: 'lap-sal-prop-link', name: '15 Years Link Documents', mandatory: false, notes: 'Continuous chain of registered documents' },
              { id: 'lap-sal-prop-plan', name: 'Plan Copy', mandatory: false },
              { id: 'lap-sal-prop-docs', name: 'Property Documents & Registered Sale Deed', mandatory: false },
              { id: 'lap-sal-prop-ec', name: 'EC 20 Years Till Date', mandatory: false, notes: 'Non-encumbrance certificate' },
              { id: 'lap-sal-prop-tax', name: 'Property Tax Receipts (Latest 3 Years)', mandatory: false },
            ],
          },
        ],
      },
      {
        id: 'senp',
        title: 'SENP Checklist (Self Employed)',
        subtitle: 'Self-Employed Non-Professional borrowers offering property as collateral',
        sections: [
          {
            title: 'Applicant Financials & KYC',
            badge: 'Mandatory',
            items: [
              { id: 'lap-se-pan', name: 'PAN Card', mandatory: true },
              { id: 'lap-se-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'lap-se-addr', name: 'Address Proof (Business / Residence)', mandatory: true },
              { id: 'lap-se-photo', name: 'Photograph', mandatory: false },
              { id: 'lap-se-bank', name: '1 Year Bank Statement (CA & SB)', mandatory: false },
              { id: 'lap-se-biz', name: 'Business Proof', mandatory: false },
              { id: 'lap-se-itr', name: '3 Years ITR, P&L & Balance Sheet with CA Attestation', mandatory: false },
            ],
          },
          {
            title: 'Co-Applicant Documents',
            badge: 'Co-Applicant',
            items: [
              { id: 'lap-se-co-pan', name: 'Co-Applicant PAN Card', mandatory: false },
              { id: 'lap-se-co-aadhaar', name: 'Co-Applicant Aadhaar Card', mandatory: false },
              { id: 'lap-se-co-photo', name: 'Co-Applicant Photograph', mandatory: false },
              { id: 'lap-se-co-bank', name: 'Co-Applicant 1 Year Bank Statement', mandatory: false },
            ],
          },
          {
            title: 'Property Documents',
            badge: 'Property',
            items: [
              { id: 'lap-se-prop-link', name: '13 Years Link Documents', mandatory: false },
              { id: 'lap-se-prop-plan', name: 'Plan Copy', mandatory: false },
              { id: 'lap-se-prop-docs', name: 'Property Documents & Title Deed', mandatory: false },
              { id: 'lap-se-prop-ec', name: 'EC Document', mandatory: false },
              { id: 'lap-se-prop-tax', name: 'Recent Property Tax Receipt', mandatory: false },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------
  // 5. EDUCATION LOAN
  // -------------------------------------------------------------
  {
    id: 'education-loan',
    domain: 'loans',
    name: 'Education Loan',
    iconName: 'GraduationCap',
    tagline: 'Domestic and overseas education loans with clear 1-PDF bundle packaging.',
    variants: [
      {
        id: 'coapp-salaried',
        title: 'Co-Applicant is Salaried',
        subtitle: 'Student applying with a salaried parent / guardian / co-borrower',
        specialInstructions: [
          'All documents must be bundled into clear single PDF files as specified below to prevent login delays.',
          'Provide 2 personal friends contact details with full names, physical addresses, and active phone numbers.',
        ],
        sections: [
          {
            title: 'Student / Main Applicant',
            badge: 'Mandatory',
            items: [
              { id: 'el-sal-stu-pan', name: 'PAN Card', mandatory: true },
              { id: 'el-sal-stu-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'el-sal-stu-addr', name: 'Address Proof', mandatory: true },
              { id: 'el-sal-stu-pass', name: 'Passport', mandatory: false, format: '1 PDF' },
              { id: 'el-sal-stu-admit', name: 'Admit Letter, I-20, GRE, IELTS, Duolingo, TOEFL, PTE', mandatory: false, format: '1 PDF', notes: 'Include all test scorecards & official admission letter' },
              { id: 'el-sal-stu-edu', name: 'SSC, Inter, Degree or B.Tech OD, PC, CMM and all individual memos', mandatory: false, format: '1 PDF', notes: 'All academic transcripts from 10th standard onwards' },
              { id: 'el-sal-stu-work', name: 'If Working: Offer Letter, Latest 3 Months Payslips, 8 Months Bank Statement to Till Date', mandatory: false, format: '1 PDF', notes: 'Applicable if student has prior employment history' },
            ],
          },
          {
            title: 'Co-Applicant 1 (Salaried)',
            badge: 'Co-Applicant 1',
            items: [
              { id: 'el-sal-co1-pan', name: 'Co-Applicant PAN Card', mandatory: false },
              { id: 'el-sal-co1-aadhaar', name: 'Co-Applicant Aadhaar Card', mandatory: false },
              { id: 'el-sal-co1-inc', name: 'Office ID, Latest 3 Months Payslips, 2 Years Form 16 & 1 Year Bank Statement to Till Date', mandatory: false, format: '1 PDF' },
              { id: 'el-sal-co1-rel', name: 'Proper Relation Proof', mandatory: false, notes: 'Birth certificate, ration card, or passport showing relationship' },
              { id: 'el-sal-co1-house', name: 'Own House Proof (Property Tax & Electricity Bill)', mandatory: false },
            ],
          },
          {
            title: 'Co-Applicant 2 (Guarantor / Additional)',
            badge: 'Co-Applicant 2',
            items: [
              { id: 'el-sal-co2-pan', name: 'Co-Applicant 2 PAN & Aadhaar', mandatory: false, format: '1 PDF' },
              { id: 'el-sal-co2-house', name: 'Electricity Bill and Property Tax', mandatory: false, format: '1 PDF' },
            ],
          },
        ],
      },
      {
        id: 'coapp-self-employed',
        title: 'Co-Applicant is Self Employed',
        subtitle: 'Student applying with a business owner or self-employed parent / guardian',
        specialInstructions: [
          'All documents must be bundled into clear single PDF files as specified below to prevent login delays.',
          'Provide 2 personal friends contact details with full names, physical addresses, and active phone numbers.',
        ],
        sections: [
          {
            title: 'Student / Main Applicant',
            badge: 'Mandatory',
            items: [
              { id: 'el-se-stu-pan', name: 'PAN Card', mandatory: true },
              { id: 'el-se-stu-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'el-se-stu-addr', name: 'Address Proof', mandatory: true },
              { id: 'el-se-stu-pass', name: 'Passport', mandatory: false, format: '1 PDF' },
              { id: 'el-se-stu-admit', name: 'Admit Letter, I-20, GRE, IELTS, Duolingo, TOEFL, PTE', mandatory: false, format: '1 PDF' },
              { id: 'el-se-stu-edu', name: 'SSC, Inter, Degree or B.Tech OD, PC, CMM and all individual memos', mandatory: false, format: '1 PDF' },
              { id: 'el-se-stu-work', name: 'If Working: Offer Letter, Latest 3 Months Payslips, 8 Months Bank Statement to Till Date', mandatory: false, format: '1 PDF' },
            ],
          },
          {
            title: 'Co-Applicant 1 (Self Employed)',
            badge: 'Co-Applicant 1',
            items: [
              { id: 'el-se-co1-pan', name: 'Co-Applicant PAN Card', mandatory: false },
              { id: 'el-se-co1-aadhaar', name: 'Co-Applicant Aadhaar Card', mandatory: false },
              { id: 'el-se-co1-itr', name: '3 Years ITR', mandatory: false },
              { id: 'el-se-co1-biz', name: 'Business Proofs (GST, Registration)', mandatory: false },
              { id: 'el-se-co1-bank', name: '1 Year Bank Statement to Till Date', mandatory: false },
              { id: 'el-se-co1-rel', name: 'Proper Relation Proof', mandatory: false },
              { id: 'el-se-co1-house', name: 'Own House Proof (Property Tax & Electricity Bill)', mandatory: false },
            ],
          },
          {
            title: 'Co-Applicant 2 (Guarantor / Additional)',
            badge: 'Co-Applicant 2',
            items: [
              { id: 'el-se-co2-pan', name: 'Co-Applicant 2 PAN & Aadhaar', mandatory: false, format: '1 PDF' },
              { id: 'el-se-co2-house', name: 'Electricity Bill and Property Tax', mandatory: false, format: '1 PDF' },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------
  // 6. CAR LOAN
  // -------------------------------------------------------------
  {
    id: 'car-loan',
    domain: 'loans',
    name: 'Car Loan',
    iconName: 'Car',
    tagline: 'New and pre-owned vehicle loan checklists for Salaried and Self-Employed customers.',
    variants: [
      {
        id: 'salaried',
        title: 'Salaried Applicant',
        subtitle: 'For salaried customers with monthly payroll credit',
        sections: [
          {
            title: 'KYC & Identification',
            badge: 'Mandatory',
            items: [
              { id: 'car-sal-pan', name: 'PAN Card', mandatory: true },
              { id: 'car-sal-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'car-sal-house', name: 'Address Proof (Own House Proof / Gas Bill)', mandatory: true },
              { id: 'car-sal-empid', name: 'Employee ID Card', mandatory: false },
            ],
          },
          {
            title: 'Vehicle & Income Details',
            badge: 'Financials',
            items: [
              { id: 'car-sal-quote', name: 'Vehicle Quotation / Proforma Invoice', mandatory: false, notes: 'Official on-road quotation from authorized dealership' },
              { id: 'car-sal-bank', name: '6 Months Bank Statement (Salary Credit)', mandatory: false },
              { id: 'car-sal-payslips', name: '3 Months Latest Pay Slips', mandatory: false },
            ],
          },
        ],
      },
      {
        id: 'self-employed',
        title: 'Self Employed Applicant',
        subtitle: 'For business owners, entrepreneurs, and self-employed professionals',
        sections: [
          {
            title: 'KYC & Residence Proof',
            badge: 'Mandatory',
            items: [
              { id: 'car-se-pan', name: 'PAN Card', mandatory: true },
              { id: 'car-se-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'car-se-house', name: 'Address Proof (Own House Proof / Gas Bill)', mandatory: true },
            ],
          },
          {
            title: 'Vehicle & Business Financials',
            badge: 'Financials',
            items: [
              { id: 'car-se-quote', name: 'Vehicle Quotation / Proforma Invoice', mandatory: false },
              { id: 'car-se-bank', name: '1 Year Bank Statement', mandatory: false },
              { id: 'car-se-itr', name: 'ITRs (3 Years)', mandatory: false },
              { id: 'car-se-biz', name: 'Business Proofs (GST, Trade Licence)', mandatory: false },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------
  // 7. LIFE INSURANCE
  // -------------------------------------------------------------
  {
    id: 'life-insurance',
    domain: 'insurance',
    name: 'Life Insurance',
    iconName: 'HeartHandshake',
    tagline: 'Term, Savings, and Investment life policy submission requirements.',
    variants: [
      {
        id: 'applicant',
        title: 'Life Insurance Applicant',
        subtitle: 'Policyholder / Life Assured documentation',
        sections: [
          {
            title: 'Applicant KYC & Residence',
            badge: 'Mandatory',
            items: [
              { id: 'li-pan', name: 'PAN Card', mandatory: true, notes: 'Mandatory for all life insurance proposals' },
              { id: 'li-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'li-address', name: 'Address Proof', mandatory: true },
            ],
          },
          {
            title: 'Proposal Login & Premium Payment',
            badge: 'Payment',
            items: [
              { id: 'li-payment', name: 'Cheque for Login OR Online Payment Confirmation', mandatory: false, notes: 'Payment can be made via online gateway link or initial premium cheque' },
            ],
          },
        ],
      },
    ],
  },

  // -------------------------------------------------------------
  // 8. HEALTH INSURANCE
  // -------------------------------------------------------------
  {
    id: 'health-insurance',
    domain: 'insurance',
    name: 'Health Insurance',
    iconName: 'Activity',
    tagline: 'Individual and Family Floater mediclaim policy documentation.',
    variants: [
      {
        id: 'applicant',
        title: 'Health Insurance Applicant & Family',
        subtitle: 'Proposer and covered family members documentation',
        sections: [
          {
            title: 'Proposer KYC & Residence',
            badge: 'Mandatory',
            items: [
              { id: 'hi-pan', name: 'PAN Card', mandatory: true },
              { id: 'hi-aadhaar', name: 'Aadhaar Card', mandatory: true },
              { id: 'hi-address', name: 'Address Proof', mandatory: true },
            ],
          },
          {
            title: 'Covered Family Members KYC',
            badge: 'Family Members',
            items: [
              { id: 'hi-family-kyc', name: 'Family Members PAN Card & Aadhaar Cards', mandatory: false, notes: 'Required for dependents to be covered under policy' },
            ],
          },
          {
            title: 'Premium Payment',
            badge: 'Payment',
            items: [
              { id: 'hi-payment', name: 'Cheque for Login OR Online Payment Confirmation', mandatory: false, notes: 'Direct netbanking, UPI, or initial premium cheque' },
            ],
          },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Helper functions for document classification and mandatory status   */
/* ------------------------------------------------------------------ */

/**
 * Checks if a document name represents a PAN card requirement.
 */
export function isPanDoc(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (lower.includes('co-applicant') || lower.includes('coapp') || lower.includes('family member')) {
    return false;
  }
  return lower.includes('pan card') || lower.includes('pan &') || lower.includes('pan and') || /^pan\b/i.test(lower);
}

/**
 * Checks if a document name represents an Aadhaar card requirement.
 */
export function isAadhaarDoc(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (lower.includes('co-applicant') || lower.includes('coapp') || lower.includes('family member')) {
    return false;
  }
  if (lower.includes('mobile') || lower.includes('phone') || lower.includes('otp')) return false;
  return lower.includes('aadhaar') || lower.includes('aadhar');
}

/**
 * Checks if a document name represents an Address/Residence proof requirement.
 */
export function isAddressProofDoc(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (lower.includes('co-applicant') || lower.includes('coapp') || lower.includes('family member')) {
    return false;
  }
  return (
    lower.includes('address proof') ||
    lower.includes('residence proof') ||
    lower.includes('current address') ||
    lower.includes('own house proof') ||
    lower.includes('gas bill') ||
    lower.includes('electricity bill') ||
    lower.includes('premises proof')
  );
}

/**
 * STRICT RULE: Only PAN Card, Aadhaar Card, and Address Proof are mandatory.
 * All other documents are optional.
 */
export function isMandatoryDoc(name: string): boolean {
  return isPanDoc(name) || isAadhaarDoc(name) || isAddressProofDoc(name);
}

/**
 * Checks if an item is purely contact / communication information rather than a file to upload.
 */
export function isContactInfoItem(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (lower.includes('mobile number') || lower.includes('phone number') || lower.includes('mobile & contact')) return true;
  if (lower.includes('email id') || lower.includes('mail id') || lower.includes('personal email') || lower.includes('official email') || lower.includes('official company email') || lower.includes('personal mail') || lower.includes('official mail')) return true;
  if (lower === 'mobile number' || lower === 'email id' || lower === 'mail id') return true;
  if (lower.includes('contact info:') || lower.includes('friends details')) return true;
  if (lower.includes('aadhaar linked mobile')) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Helper: map service type + employment to a flat document checklist  */
/* Used by the Add Lead form to pull the exact documents shown on the  */
/* Documentation Required page.                                        */
/* ------------------------------------------------------------------ */

const SERVICE_TO_DOC_CATEGORY: Record<string, string> = {
  'Personal Loan': 'personal-loan',
  'Business Loan': 'business-loan',
  'Home Loan': 'home-loan',
  'Loan Against Property': 'lap',
  'Vehicle Loan': 'car-loan',
  'Education Loan': 'education-loan',
  'Credit Card': '',
  Insurance: '',
  'Other Financial Services': '',
};

/**
 * Picks the best variant ID based on employment type and business constitution.
 */
function pickVariantId(
  categoryId: string,
  employmentType: string,
  businessType?: string,
  insuranceType?: string,
): string {
  if (categoryId === 'business-loan') {
    if (businessType === 'Private Limited' || businessType === 'Public Limited') return 'pvt-ltd';
    if (businessType === 'Partnership' || businessType === 'LLP') return 'partnership';
    return 'proprietorship'; // default for Proprietorship or unspecified
  }

  if (categoryId === 'personal-loan') {
    return employmentType === 'Self Employed' || employmentType === 'Business'
      ? 'self-employed'
      : 'salaried';
  }

  // For insurance: pick based on insuranceType
  if (insuranceType) {
    if (insuranceType.toLowerCase().includes('health')) {
      return 'applicant'; // health-insurance variant
    }
    return 'applicant'; // life-insurance variant
  }

  // Home Loan, LAP, Car Loan: salaried vs self-employed
  if (employmentType === 'Salaried') return 'salaried';
  if (employmentType === 'Self Employed' || employmentType === 'Business') {
    return categoryId === 'lap' ? 'senp' : 'self-employed';
  }
  return 'salaried'; // fallback
}

/**
 * Returns a flat `{ name, required }[]` checklist for the Add Lead document
 * upload step, sourced from DOCUMENTATION_DATA used by the "Documentation Required" page.
 *
 * Enforces that ONLY PAN Card, Aadhaar Card, and Address Proof are mandatory (`required: true`),
 * and all remaining documents are optional (`required: false`).
 * Filters out non-document items like contact details.
 */
export function getDocumentChecklist(
  service: string,
  employmentType: string,
  businessType?: string,
  insuranceType?: string,
): { name: string; required: boolean }[] | undefined {
  // For insurance, resolve to the correct documentation category
  let categoryId = SERVICE_TO_DOC_CATEGORY[service];
  if (service === 'Insurance') {
    if (insuranceType && insuranceType.toLowerCase().includes('health')) {
      categoryId = 'health-insurance';
    } else {
      categoryId = 'life-insurance';
    }
  }

  if (!categoryId) return undefined;

  const docCategory = DOCUMENTATION_DATA.find((c) => c.id === categoryId);
  if (!docCategory) return undefined;

  const variantId = pickVariantId(categoryId, employmentType, businessType, insuranceType);
  const variant = docCategory.variants.find((v) => v.id === variantId) ?? docCategory.variants[0];
  if (!variant) return undefined;

  // Flatten all sections into one checklist, deduplicating by name
  const seen = new Set<string>();
  const checklist: { name: string; required: boolean }[] = [];

  for (const section of variant.sections) {
    for (const item of section.items) {
      if (isContactInfoItem(item.name)) continue;
      if (!seen.has(item.name)) {
        seen.add(item.name);
        checklist.push({
          name: item.name,
          required: isMandatoryDoc(item.name),
        });
      }
    }
  }

  // Ensure PAN Card, Aadhaar Card, and Address Proof are present in the list
  const hasPan = checklist.some((c) => isPanDoc(c.name));
  const hasAadhaar = checklist.some((c) => isAadhaarDoc(c.name));
  const hasAddress = checklist.some((c) => isAddressProofDoc(c.name));

  if (!hasPan) checklist.unshift({ name: 'PAN Card', required: true });
  if (!hasAadhaar) checklist.splice(hasPan ? 1 : 0, 0, { name: 'Aadhaar Card', required: true });
  if (!hasAddress) checklist.push({ name: 'Address Proof', required: true });

  return checklist;
}
