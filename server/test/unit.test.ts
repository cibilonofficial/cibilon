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
