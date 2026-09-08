import assert from 'node:assert/strict';
import test from 'node:test';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://test:test@127.0.0.1:5432/cibilon_test',
  JWT_ACCESS_SECRET: 'test-jwt-access-secret-with-at-least-32-characters',
  DATA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  DOCUMENT_ENCRYPTION_KEY: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
});

const { APPLICATION_STATUS_TRANSITIONS } = await import('../src/common/domain.js');
const { calculatePayoutAmount } = await import('../src/modules/payouts/payout.service.js');
const { validateDocumentFile } = await import('../src/modules/documents/file-validation.js');
const { encryptSensitive, decryptSensitive, maskedLastFour } = await import('../src/lib/sensitive-data.js');
const { updateApplicationStatusSchema } = await import('../src/modules/applications/application.schemas.js');
const { employmentSchema } = await import('../src/modules/leads/lead.schemas.js');
const { envSchema } = await import('../src/config/env.js');
const { comparisonPeriods, compareMonths } = await import('../src/modules/reports/monthly-comparison.js');
const { categoryFor, validateCategoryFields } = await import('../../shared/service-categories.js');
const { calculateEmi, payoutRange, payoutRangeFromRateCard } = await import('../../src/lib/finance.js');
const { DOCUMENTATION_DATA, getDocumentChecklist } = await import('../../src/data/documentationData.js');

test('payout range and EMI calculations use configured values', () => {
  const range = payoutRange({
    commissionOptions: [
      { calculationType: 'PERCENTAGE', percentageRate: 2.3 },
      { calculationType: 'PERCENTAGE', percentageRate: 3.9 },
    ],
  } as never, 100_000);
  assert.deepEqual(range, {
    minimum: 2300, maximum: 3900, minRate: 2.3, maxRate: 3.9, kind: 'percentage',
  });
  const zeroInterest = calculateEmi(120_000, 0, 12);
  assert.equal(zeroInterest?.emi, 10_000);
  const standard = calculateEmi(1_000_000, 9, 240);
  assert.equal(Math.round(standard?.emi ?? 0), 8997);
});

test('PDF rate-card range uses the lowest and highest numeric rates for the selected service', () => {
  const entries = [
    { categoryName: 'Personal Loan', percentageRate: 2.9 },
    { categoryName: 'Personal Loan', percentageRate: 0.8 },
    { categoryName: 'Personal Loan', percentageRate: 4 },
    { categoryName: 'Business Loan', percentageRate: 3.09 },
    { categoryName: 'Personal Loan', percentageRate: null },
  ];
  assert.deepEqual(payoutRangeFromRateCard(entries as never, 'Personal Loan', 100_000), {
    minimum: 800, maximum: 4000, minRate: 0.8, maxRate: 4,
  });
  assert.equal(payoutRangeFromRateCard(entries as never, 'Home Loan', 100_000), null);
});

test('lead categories derive consistently and enforce relevant required fields', () => {
  assert.equal(categoryFor('Home Loan'), 'Loan');
  assert.equal(categoryFor('Insurance'), 'Insurance');
  assert.equal(categoryFor('Other Financial Services', 'CIBIL Repair'), 'CIBIL Repair');
  assert.deepEqual(Object.keys(validateCategoryFields('CIBIL Repair', {})), ['repairService', 'creditIssue', 'previousDispute']);
  assert.equal(Object.keys(validateCategoryFields('CIBIL Repair', {
    repairService: 'Credit report review', creditIssue: 'An incorrect overdue account', previousDispute: 'No', currentScore: '751',
  })).length, 0);
  assert.match(validateCategoryFields('CIBIL Repair', {
    repairService: 'Credit report review', creditIssue: 'Issue', previousDispute: 'No', currentScore: '1000',
  }).currentScore ?? '', /300 to 900/);
  assert.equal(validateCategoryFields('CIBIL Repair', {
    repairService: 'Credit report review', creditIssue: 'Issue', previousDispute: 'No', unknown: 'value',
  }).unknown, 'Unsupported category field.');
});

test('required-document hierarchy exposes services, types, and grouped documents progressively', () => {
  assert.deepEqual(new Set(DOCUMENTATION_DATA.map((service) => service.id)), new Set([
    'personal-loan', 'business-loan', 'home-loan', 'lap', 'education-loan',
    'life-insurance', 'health-insurance', 'car-loan',
  ]));
  const personalLoan = DOCUMENTATION_DATA.find((service) => service.id === 'personal-loan');
  assert.deepEqual(personalLoan?.variants.map((variant) => variant.id), ['salaried', 'self-employed']);
  const businessLoan = DOCUMENTATION_DATA.find((service) => service.id === 'business-loan');
  assert.deepEqual(businessLoan?.variants.map((variant) => variant.title), [
    'Proprietorship', 'Partnership Firm', 'Private Limited Company',
  ]);
  const lifeInsurance = DOCUMENTATION_DATA.find((service) => service.id === 'life-insurance');
  assert.equal(lifeInsurance?.variants.length, 1);
  const homeLoan = DOCUMENTATION_DATA.find((service) => service.id === 'home-loan');
  assert((homeLoan?.variants[0]?.sections.length ?? 0) >= 3);
  assert(getDocumentChecklist('Personal Loan', 'Self Employed')?.some((item) => item.name.includes('IT Returns')));
});

test('monthly percentages handle zero baselines, decreases and rounding', () => {
  assert.equal(compareMonths(0, 0).percent, 0);
  assert.equal(compareMonths(2, 0).percent, null);
  assert.equal(compareMonths(0, 2).percent, -100);
  assert.equal(compareMonths(4, 3).percent, 33.3);
  assert.equal(compareMonths(3, 4).percent, -25);
});

test('India calendar-month boundaries handle midnight, year rollover and leap years', () => {
  const january = comparisonPeriods(new Date('2025-12-31T18:30:00.000Z'));
  assert.equal(january.currentStart.toISOString(), '2025-12-31T18:30:00.000Z');
  assert.equal(january.previousStart.toISOString(), '2025-11-30T18:30:00.000Z');
  const february = comparisonPeriods(new Date('2024-02-29T18:29:59.999Z'));
  assert.equal(february.currentStart.toISOString(), '2024-01-31T18:30:00.000Z');
  const march = comparisonPeriods(new Date('2024-02-29T18:30:00.000Z'));
  assert.equal(march.currentStart.toISOString(), '2024-02-29T18:30:00.000Z');
  assert.equal(march.previousStart.toISOString(), '2024-01-31T18:30:00.000Z');
});

test('application status transitions allow the workflow and lock terminal states', () => {
  assert(APPLICATION_STATUS_TRANSITIONS.SUBMITTED.includes('UNDER_REVIEW'));
  assert(!APPLICATION_STATUS_TRANSITIONS.SUBMITTED.includes('DISBURSED'));
  assert.deepEqual(APPLICATION_STATUS_TRANSITIONS.DISBURSED, []);
  assert.deepEqual(APPLICATION_STATUS_TRANSITIONS.REJECTED, []);
});

test('payout calculation is precise for percentage and flat rules', () => {
  assert.equal(calculatePayoutAmount('PERCENTAGE', 100_000, { toString: () => '1.6' }, null), '1600.00');
  assert.equal(calculatePayoutAmount('PERCENTAGE', 12_345.67, { toString: () => '0.75' }, null), '92.59');
  assert.equal(calculatePayoutAmount('FLAT', 100_000, null, { toString: () => '2500' }), '2500.00');
});

test('disbursal input requires lender and amount', () => {
  assert.equal(updateApplicationStatusSchema.safeParse({ status: 'APPROVED' }).success, false);
  assert.equal(updateApplicationStatusSchema.safeParse({ status: 'APPROVED', lenderId: crypto.randomUUID() }).success, true);
  assert.equal(updateApplicationStatusSchema.safeParse({ status: 'DISBURSED' }).success, false);
  assert.equal(updateApplicationStatusSchema.safeParse({ status: 'DISBURSED', lenderId: crypto.randomUUID(), disbursedAmount: 1 }).success, true);
});

test('employment input accepts exact and banded credit scores from the advisor form', () => {
  assert.equal(employmentSchema.safeParse({ creditScore: 780 }).success, true);
  assert.equal(employmentSchema.safeParse({ creditScore: 'Above 800' }).success, true);
  assert.equal(employmentSchema.safeParse({ creditScore: 'Not known' }).success, true);
  assert.equal(employmentSchema.safeParse({ creditScore: null }).success, false);
});

test('document validation checks magic bytes as well as declared MIME type', () => {
  const valid = { buffer: Buffer.from('%PDF-1.4\n'), mimetype: 'application/pdf' } as Express.Multer.File;
  assert.equal(validateDocumentFile(valid).mimeType, 'application/pdf');
  const spoofed = { buffer: Buffer.from('not a pdf'), mimetype: 'application/pdf' } as Express.Multer.File;
  assert.throws(() => validateDocumentFile(spoofed), /content does not match/i);
});

test('sensitive values are randomized, reversible, and masked by default', () => {
  const first = encryptSensitive('ABCDE1234F');
  const second = encryptSensitive('ABCDE1234F');
  assert.notEqual(first, second);
  assert.equal(decryptSensitive(first), 'ABCDE1234F');
  assert.equal(maskedLastFour('1234'), '••••1234');
});

test('production environment rejects insecure cookies and missing monitoring secrets', () => {
  const parsed = envSchema.safeParse({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://example.invalid/cibilon',
    FRONTEND_ORIGIN: 'http://example.com',
    JWT_ACCESS_SECRET: 'replace-with-at-least-32-random-characters',
    DATA_ENCRYPTION_KEY: '0'.repeat(64),
    COOKIE_SECURE: 'false',
  });
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) => issue.path.join('.'));
    assert(paths.includes('COOKIE_SECURE'));
    assert(paths.includes('METRICS_TOKEN'));
    assert(paths.includes('DOCUMENT_ENCRYPTION_KEY'));
    assert(paths.includes('FRONTEND_ORIGIN'));
  }
});
