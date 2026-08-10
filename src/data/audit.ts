import { daysAgo } from '@/lib/utils';
import type { AuditEntry, AuditModule, Role } from '@/types';

type Row = [
  hoursAgoDays: number,
  hour: number,
  actorName: string,
  actorRole: Role | 'System',
  action: string,
  module: AuditModule,
  entityId: string | null,
  details: string,
];

const IPS = ['103.21.244.18', '49.36.180.72', '157.32.14.201', '182.71.9.44', '106.51.77.13'];

const ROWS: Row[] = [
  [0, 9, 'Ananya Iyer', 'admin', 'Signed in', 'Auth', null, 'Session started from the Mumbai office network'],
  [0, 10, 'Sneha Pillai', 'admin', 'Verified document', 'Documents', 'APP1047', 'Marked “Salary Slips (3 months)” as verified'],
  [0, 10, 'Rohan Mehta', 'advisor', 'Uploaded document', 'Documents', 'APP1045', 'Re-uploaded “Bank Statements (6 months)” after a bounce'],
  [0, 11, 'Rahul Verma', 'admin', 'Updated application status', 'Applications', 'APP1046', 'Under Review → Processing'],
  [0, 12, 'Ananya Iyer', 'admin', 'Assigned application', 'Applications', 'APP1063', 'Assigned to Karan Bhatt (Credit Analyst)'],
  [0, 14, 'Rohan Mehta', 'advisor', 'Created lead', 'Leads', 'LD-1050', 'New personal loan lead for Deepak Chauhan'],
  [1, 9, 'Divya Sethi', 'admin', 'Released payout', 'Payouts', 'PO-1042', 'Marked ₹45,000 as paid via NEFT'],
  [1, 11, 'Sneha Pillai', 'admin', 'Requested re-upload', 'Documents', 'APP1058', 'Salary slips illegible — re-upload requested from DSA-1113'],
  [1, 13, 'Ananya Iyer', 'admin', 'Updated lender', 'Lenders', 'LN-09', 'Yes Bank moved from Active to Paused'],
  [1, 15, 'Vikram Singh', 'advisor', 'Submitted application', 'Applications', 'APP1058', 'Personal loan for Tanvi Sharma, ₹11,00,000'],
  [2, 10, 'Karan Bhatt', 'admin', 'Updated application status', 'Applications', 'APP1044', 'Submitted to Lender → Approved'],
  [2, 11, 'Ananya Iyer', 'admin', 'Updated product configuration', 'Products', null, 'Personal Loan payout rate reviewed for the quarter'],
  [2, 16, 'Priya Nair', 'advisor', 'Signed in', 'Auth', null, 'Session started from Bengaluru'],
  [3, 9, 'Nikhil Rao', 'admin', 'Replied to ticket', 'Support', 'TK-1003', 'Responded on the payout timeline query'],
  [3, 12, 'Rahul Verma', 'admin', 'Updated application status', 'Applications', 'APP1051', 'Additional information requested from the advisor'],
  [3, 14, 'Ananya Iyer', 'admin', 'Deactivated advisor', 'Advisors', 'ADV-1201', 'Arjun Reddy set to Inactive pending KYC refresh'],
  [4, 10, 'Divya Sethi', 'admin', 'Started payout run', 'Payouts', null, '6 payouts moved to Processing for the fortnightly cycle'],
  [4, 11, 'Sneha Pillai', 'admin', 'Verified document', 'Documents', 'APP1055', 'Property documents cleared by the verification desk'],
  [4, 15, 'Ananya Iyer', 'admin', 'Added staff member', 'Team', 'EMP-044', 'Pooja Shetty onboarded as Verification Officer'],
  [5, 9, 'Rohan Mehta', 'advisor', 'Raised support ticket', 'Support', 'TK-1001', 'Query on the LAP document checklist'],
  [5, 12, 'Karan Bhatt', 'admin', 'Updated application status', 'Applications', 'APP1048', 'Rejected — GST turnover inconsistent with declared income'],
  [6, 10, 'Ananya Iyer', 'admin', 'Empanelled lender', 'Lenders', 'LN-11', 'HDFC Life added to the insurance panel'],
  [6, 13, 'Sneha Kulkarni', 'advisor', 'Submitted application', 'Applications', 'APP1059', 'Vehicle loan for Amit Deshpande, ₹15,50,000'],
  [7, 11, 'System', 'System', 'Generated payout', 'Payouts', 'PO-1053', 'Payout raised automatically on disbursal of APP1053'],
  [8, 10, 'Ananya Iyer', 'admin', 'Exported report', 'Applications', null, 'Monthly disbursement report downloaded'],
  [9, 12, 'Rahul Verma', 'admin', 'Updated application status', 'Applications', 'APP1043', 'Processing → Submitted to Lender (ICICI Bank)'],
  [11, 9, 'System', 'System', 'Scheduled job', 'Auth', null, 'Nightly session cleanup completed'],
  [14, 15, 'Ananya Iyer', 'admin', 'Updated product configuration', 'Products', null, 'Home Loan maximum tenure extended to 360 months'],
];

export const SEED_AUDIT: AuditEntry[] = ROWS.map(
  ([days, hour, actorName, actorRole, action, module, entityId, details], i) => ({
    id: `AL-${1000 + i}`,
    at: daysAgo(days, hour),
    actorName,
    actorRole,
    action,
    module,
    entityId,
    details,
    ip: actorRole === 'System' ? '—' : IPS[i % IPS.length],
  }),
);
