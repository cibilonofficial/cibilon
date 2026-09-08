import 'dotenv/config';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

function resolveTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL or DATABASE_URL is required');
  const url = new URL(process.env.DATABASE_URL);
  const current = decodeURIComponent(url.pathname.slice(1));
  url.pathname = `/${current}_test`;
  return url.toString();
}

const metricsToken = 'phase-8-test-metrics-token-32-characters';
const password = process.env.TEST_SEED_PASSWORD ?? 'Cibilon@Test123!';
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: resolveTestDatabaseUrl(),
  API_HOST: '127.0.0.1',
  API_PORT: '4001',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  JWT_ACCESS_SECRET: 'phase-8-test-jwt-secret-with-more-than-32-characters',
  DATA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  DOCUMENT_ENCRYPTION_KEY: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  LOCAL_STORAGE_PATH: './storage/test-documents',
  EXPORT_STORAGE_PATH: './storage/test-exports',
  METRICS_TOKEN: metricsToken,
  GLOBAL_RATE_LIMIT_MAX: '10000',
  AUTH_RATE_LIMIT_MAX: '1000',
  LOGIN_RATE_LIMIT_MAX: '3',
  LOG_LEVEL: 'silent',
});

const { createApp } = await import('../src/app.js');
const { prisma } = await import('../src/lib/prisma.js');
const server = createServer(createApp());
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Test server did not expose a TCP address');
const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

async function request(route: string, options: { token?: string; method?: string; body?: unknown; headers?: Record<string, string>; expected?: number } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  const payload = text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
  assert.equal(response.status, options.expected ?? 200, `${options.method ?? 'GET'} ${route}: ${response.status} ${text}`);
  return { response, payload };
}

async function login(identifier: string) {
  const { payload } = await request('/auth/login', { method: 'POST', body: { identifier, password, remember: false } });
  return payload.data.accessToken as string;
}

test('Phase 8 security and business-rule integration suite', async (t) => {
  await t.test('health, headers, CORS and protected metrics', async () => {
    const live = await request('/health/live', { headers: { origin: 'http://localhost:5173' } });
    assert.equal(live.payload.data.status, 'alive');
    assert.equal(live.response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(live.response.headers.get('x-content-type-options'), 'nosniff');
    assert(live.response.headers.get('content-security-policy'));
    await request('/health/ready');
    await request('/health/live', { headers: { origin: 'https://evil.example' }, expected: 403 });
    await request('/metrics', { expected: 401 });
    const metrics = await request('/metrics', { headers: { 'x-metrics-token': metricsToken } });
    assert(metrics.payload.data.http.requestsTotal >= 5);
    const malformed = await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json() as { error: { code: string } }).error.code, 'INVALID_JSON');
  });

  const admin = await login('admin@cibilon.in');
  const advisor = await login('advisor@cibilon.in');
  const seededStaff = await login('staff@cibilon.in');

  await t.test('authentication and RBAC reject unauthorized access', async () => {
    await request('/me', { expected: 401 });
    await request('/audit-logs', { token: advisor, expected: 403 });
    await request('/audit-logs', { token: seededStaff, expected: 403 });
    await request('/advisors', { token: seededStaff, expected: 403 });
    await request('/payouts', { token: seededStaff, expected: 403 });
    await request('/audit-logs', { token: admin });
  });

  await t.test('PDF payout rate card is available to advisors and editable only by admins', async () => {
    await request('/payout-rate-card', { expected: 401 });
    const published = await request('/payout-rate-card', { token: advisor });
    const personalLoanRates = published.payload.data
      .filter((item: { categoryName: string; percentageRate: string | null }) => item.categoryName === 'Personal Loan' && item.percentageRate !== null)
      .map((item: { percentageRate: string }) => Number(item.percentageRate));
    assert.equal(Math.min(...personalLoanRates), 0.8);
    assert.equal(Math.max(...personalLoanRates), 4);
    await request('/payout-rate-card', {
      token: advisor,
      method: 'POST',
      expected: 403,
      body: { categoryId: 'personal-loan', categoryName: 'Personal Loan', providerName: 'Blocked Bank', productName: 'Blocked', payoutText: '1.00%', percentageRate: 1 },
    });
    const created = await request('/payout-rate-card', {
      token: admin,
      method: 'POST',
      expected: 201,
      body: { categoryId: 'personal-loan', categoryName: 'Personal Loan', providerName: 'Integration Bank', productName: 'Test product', payoutText: '1.25%', percentageRate: 1.25 },
    });
    const updated = await request(`/payout-rate-card/${created.payload.data.id}`, {
      token: admin,
      method: 'PATCH',
      body: { payoutText: '1.30%', percentageRate: 1.3 },
    });
    assert.equal(updated.payload.data.percentageRate, '1.3');
  });

  const stamp = Date.now();
  const secondEmail = `phase8.advisor.${stamp}@example.test`;
  const secondAdvisorBody = {
    name: 'Phase Eight Second Advisor',
    email: secondEmail,
    mobile: `+918${String(stamp).slice(-9)}`,
    password,
    code: `P8-${stamp}`,
  };
  let secondAdvisor = '';
  await t.test('super admin can create multiple advisor logins', async () => {
    await request('/advisors', {
      token: admin,
      method: 'POST',
      expected: 201,
      body: secondAdvisorBody,
    });
    await request('/advisors', {
      token: admin,
      method: 'POST',
      expected: 409,
      body: secondAdvisorBody,
    });
    await request('/advisors', {
      token: advisor,
      method: 'POST',
      expected: 403,
      body: { ...secondAdvisorBody, email: `blocked.${secondEmail}`, mobile: `+917${String(stamp).slice(-9)}`, code: `BLOCKED-${stamp}` },
    });
    secondAdvisor = await login(secondEmail);
    assert(secondAdvisor);
  });

  let createdStaff: { id: string } = { id: '' };
  let createdStaffToken = '';
  await t.test('super admin can create a staff login with a restricted workspace', async () => {
    const created = await request('/staff', {
      token: admin,
      method: 'POST',
      expected: 201,
      body: {
        name: 'Assigned File Tester',
        email: `phase8.staff.${stamp}@example.test`,
        mobile: `+916${String(stamp).slice(-9)}`,
        code: `EMP-${stamp}`,
        department: 'Operations',
        role: 'CREDIT_ANALYST',
        password,
        permissionCodes: [],
      },
    });
    createdStaff = created.payload.data;
    createdStaffToken = await login(`phase8.staff.${stamp}@example.test`);
    const identity = await request('/me', { token: createdStaffToken });
    assert(identity.payload.data.roles.includes('staff'));
    assert(identity.payload.data.permissions.includes('applications:read:any'));
    assert(!identity.payload.data.permissions.includes('staff:read:any'));
    await request('/staff', { token: createdStaffToken, expected: 403 });
  });

  const leadResult = await request('/leads', {
    token: advisor,
    method: 'POST',
    expected: 201,
    body: {
      customer: {
        fullName: `Phase Eight Customer ${stamp}`,
        mobile: `7${String(stamp).slice(-9)}`,
        email: `phase8.customer.${stamp}@example.test`,
        dateOfBirth: '1990-01-15', gender: 'OTHER', pan: 'FGHIJ5678K',
        aadhaar: `9${String(stamp).slice(-11)}`, addressLine: '8 Security Road',
        city: 'Bengaluru', state: 'Karnataka', pincode: '560001',
      },
      serviceType: 'Personal Loan', requestedAmount: 100000,
      employment: { employmentType: 'Salaried', monthlyIncome: 75000, organisation: 'Phase Eight Labs', experience: '5 years', existingLoans: 'No', bankName: 'HDFC Bank', accountNumber: '123456789012', ifsc: 'HDFC0001234' },
      serviceDetails: { tenure: '24 months', purpose: 'Phase 8 integration test' },
      source: 'Phase 8 integration suite',
    },
  });
  const lead = leadResult.payload.data;
  assert.equal(lead.customer.panEncrypted, undefined);
  assert.equal(lead.customer.panMasked, '••••678K');

  await t.test('advisor ownership is enforced from database ownership', async () => {
    await request(`/leads/${lead.id}`, { token: secondAdvisor, expected: 403 });
    await request(`/leads/${lead.id}`, { token: advisor });
    await request(`/leads/${lead.id}`, { token: admin });
  });

  const converted = await request(`/leads/${lead.id}/convert`, { token: advisor, method: 'POST', expected: 201, body: { remarks: 'Phase 8 workflow test' } });
  const application = converted.payload.data;

  await t.test('monthly comparisons use scoped database totals and require authentication', async () => {
    await request('/reports/monthly-comparisons', { expected: 401 });
    const { comparisonPeriods } = await import('../src/modules/reports/monthly-comparison.js');
    const identity = await request('/me', { token: advisor });
    const result = await request('/reports/monthly-comparisons', { token: advisor });
    const periods = comparisonPeriods(new Date(result.payload.data.asOf));
    const expected = await prisma.lead.count({ where: {
      advisorId: identity.payload.data.advisorId,
      createdAt: { gte: periods.currentStart, lt: periods.asOf },
    } });
    assert.equal(result.payload.data.leads.current, expected);
    assert(result.payload.data.leads.current >= 1);
    const ownEmpty = await request('/reports/monthly-comparisons', { token: secondAdvisor });
    assert.equal(ownEmpty.payload.data.leads.current, 0);
    const network = await request('/reports/monthly-comparisons', { token: admin });
    assert(network.payload.data.leads.current >= expected);
    const catalog = await request('/products?pageSize=100', { token: advisor });
    const personalLoan = catalog.payload.data.find((item: { serviceType: string }) => item.serviceType === 'Personal Loan');
    assert(personalLoan.commissionOptions.length >= 1);
    assert.equal(personalLoan.commissionOptions[0].calculationType, 'PERCENTAGE');
  });

  await t.test('admin document templates drive new application checklists', async () => {
    const catalog = await request('/products?pageSize=100', { token: admin });
    const insurance = catalog.payload.data.find((item: { serviceType: string }) => item.serviceType === 'Insurance');
    await request(`/products/${insurance.id}`, {
      token: admin,
      method: 'PATCH',
      body: { documents: [
        { documentType: 'identity_proof', displayName: 'Identity Proof', required: true },
        { documentType: 'policy_copy', displayName: 'Existing Policy Copy', required: false },
      ] },
    });
    const insuranceLead = await request('/leads', {
      token: advisor,
      method: 'POST',
      expected: 201,
      body: {
        customer: {
          fullName: `Insurance Customer ${stamp}`, mobile: `9${String(stamp).slice(-9)}`,
          email: `insurance.customer.${stamp}@example.test`, dateOfBirth: '1992-05-12',
          gender: 'OTHER', pan: 'QRSTU1234V', aadhaar: `7${String(stamp).slice(-11)}`,
          addressLine: '12 Policy Road', city: 'Pune', state: 'Maharashtra', pincode: '411001',
        },
        serviceType: 'Insurance',
        serviceDetails: {
          category: 'Insurance', insuranceType: 'Health Insurance', sumAssured: 500000,
          categoryFields: { insuredPerson: 'Self', coverageNeeds: 'Family health protection', existingCover: 'No' },
        },
        source: 'Catalog document test',
      },
    });
    const convertedInsurance = await request(`/leads/${insuranceLead.payload.data.id}/convert`, {
      token: advisor, method: 'POST', expected: 201, body: {},
    });
    const checklist = await request(`/applications/${convertedInsurance.payload.data.id}/documents`, { token: advisor });
    assert.deepEqual(checklist.payload.data.map((item: { displayName: string }) => item.displayName), [
      'Identity Proof', 'Existing Policy Copy',
    ]);
  });

  await t.test('admin payout rules are published to the advisor catalog', async () => {
    const catalog = await request('/products?pageSize=100', { token: admin });
    const homeLoan = catalog.payload.data.find((item: { serviceType: string }) => item.serviceType === 'Home Loan');
    const lenderId = homeLoan.lenders[0].lenderId;
    await request(`/products/${homeLoan.id}/commission-rules`, {
      token: admin,
      method: 'POST',
      expected: 201,
      body: { lenderId, calculationType: 'PERCENTAGE', percentageRate: 3.9, effectiveFrom: new Date().toISOString() },
    });
    const published = await request(`/products/${homeLoan.id}`, { token: advisor });
    const option = published.payload.data.commissionOptions.find((item: { lenderId: string | null }) => item.lenderId === lenderId);
    assert.equal(option.percentageRate, '3.9');
  });

  await t.test('category-specific lead converts without loan employment data and creates its checklist', async () => {
    const categoryLead = await request('/leads', {
      token: advisor,
      method: 'POST',
      expected: 201,
      body: {
        customer: {
          fullName: `Category Customer ${stamp}`,
          mobile: `6${String(stamp).slice(-9)}`,
          email: `category.customer.${stamp}@example.test`,
          dateOfBirth: '1988-04-20', gender: 'OTHER', pan: 'LMNOP6789Q',
          aadhaar: `8${String(stamp).slice(-11)}`, addressLine: '21 Category Road',
          city: 'Hyderabad', state: 'Telangana', pincode: '500001',
        },
        serviceType: 'Other Financial Services',
        serviceDetails: {
          category: 'CIBIL Repair',
          categoryFields: {
            repairService: 'Incorrect account or payment information',
            currentScore: '690',
            creditIssue: 'A closed account is shown as overdue.',
            previousDispute: 'No',
          },
        },
        source: 'Category integration suite',
      },
    });
    const convertedCategory = await request(`/leads/${categoryLead.payload.data.id}/convert`, {
      token: advisor, method: 'POST', expected: 201, body: { remarks: 'Category workflow test' },
    });
    assert.equal(convertedCategory.payload.data.serviceSnapshot.category, 'CIBIL Repair');
    assert.equal(convertedCategory.payload.data.serviceSnapshot.categoryFields.currentScore, '690');
    const checklist = await request(`/applications/${convertedCategory.payload.data.id}/documents`, { token: advisor });
    assert.deepEqual(checklist.payload.data.map((item: { displayName: string }) => item.displayName), [
      'PAN Card', 'Aadhaar Card', 'Address Proof', 'Credit Report (if available)', 'Dispute Supporting Documents',
    ]);
    const categoryLenders = await request('/lenders?status=ACTIVE&pageSize=1', { token: admin });
    await request(`/applications/${convertedCategory.payload.data.id}/status`, {
      token: admin,
      method: 'PATCH',
      body: {
        status: 'APPROVED',
        lenderId: categoryLenders.payload.data[0].id,
        remarks: 'Category application approved without an artificial loan amount',
      },
    });
    const categoryPayouts = await request(
      `/payouts?applicationId=${convertedCategory.payload.data.id}`,
      { token: advisor },
    );
    assert.equal(categoryPayouts.payload.data.length, 0);
  });

  await t.test('staff can see only an application assigned to them', async () => {
    const before = await request('/applications?pageSize=100', { token: createdStaffToken });
    assert.equal(before.payload.data.length, 0);
    await request(`/applications/${application.id}`, { token: createdStaffToken, expected: 403 });
    await request(`/applications/${application.id}/documents`, { token: createdStaffToken, expected: 403 });
    await request(`/applications/${application.id}/assignment`, {
      token: admin,
      method: 'PUT',
      body: { staffId: createdStaff.id, note: 'Assigned by integration test' },
    });
    const after = await request('/applications?pageSize=100', { token: createdStaffToken });
    assert.deepEqual(after.payload.data.map((item: { id: string }) => item.id), [application.id]);
    const detail = await request(`/applications/${application.id}`, { token: createdStaffToken });
    assert.equal(detail.payload.data.estimatedPayout, '1600.00');
    await request(`/applications/${application.id}/documents`, { token: createdStaffToken });
    await request(`/applications/${application.id}/assignment`, {
      token: createdStaffToken,
      method: 'PUT',
      expected: 403,
      body: { staffId: null },
    });
  });

  await t.test('document content validation rejects spoofed uploads', async () => {
    const checklist = await request(`/applications/${application.id}/documents`, { token: advisor });
    const requestId = checklist.payload.data[0].id;
    const form = new FormData();
    form.set('documentRequestId', requestId);
    form.set('file', new Blob(['not a pdf'], { type: 'application/pdf' }), 'spoofed.pdf');
    const response = await fetch(`${baseUrl}/applications/${application.id}/documents`, { method: 'POST', headers: { authorization: `Bearer ${advisor}` }, body: form });
    assert.equal(response.status, 422);
    const payload = await response.json() as { error: { code: string } };
    assert.equal(payload.error.code, 'INVALID_DOCUMENT_CONTENT');
  });

  await t.test('local document content is encrypted at rest and decrypted on authorized download', async () => {
    const checklist = await request(`/applications/${application.id}/documents`, { token: advisor });
    const requestId = checklist.payload.data[0].id;
    const plaintext = Buffer.from('%PDF-1.4\nPhase 8 encrypted document\n');
    const form = new FormData();
    form.set('documentRequestId', requestId);
    form.set('file', new Blob([plaintext], { type: 'application/pdf' }), 'phase8.pdf');
    const upload = await fetch(`${baseUrl}/applications/${application.id}/documents`, { method: 'POST', headers: { authorization: `Bearer ${advisor}` }, body: form });
    const uploadText = await upload.text();
    assert.equal(upload.status, 201, uploadText);
    const uploadPayload = JSON.parse(uploadText);
    const documentId = uploadPayload.data.document.id;
    const version = await prisma.documentVersion.findFirstOrThrow({ where: { documentId }, orderBy: { version: 'desc' } });
    const stored = await readFile(path.resolve(process.env.LOCAL_STORAGE_PATH!, version.storageKey));
    assert.equal(stored.subarray(0, 13).toString('ascii'), 'CIBLON-DOC-V1');
    assert.equal(stored.includes(plaintext), false);
    const download = await fetch(`${baseUrl}/documents/${documentId}/download`, { headers: { authorization: `Bearer ${advisor}` } });
    assert.equal(download.status, 200);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), plaintext);
  });

  await t.test('flexible status transitions and disbursal payout are enforced', async () => {
    const beforeApproval = await request(`/applications/${application.id}`, { token: admin });
    assert.equal(beforeApproval.payload.data.estimatedPayout, '1600.00');
    await request(`/applications/${application.id}/status`, { token: admin, method: 'PATCH', body: { status: 'DISBURSED' }, expected: 422 });
    const lenders = await request('/lenders?status=ACTIVE&pageSize=1', { token: admin });
    const lenderId = lenders.payload.data[0].id;
    await request(`/applications/${application.id}/status`, { token: admin, method: 'PATCH', body: { status: 'APPROVED', lenderId, remarks: 'Approved directly by super admin' } });
    const approvedPayouts = await request(`/payouts?applicationId=${application.id}`, { token: advisor });
    assert.equal(approvedPayouts.payload.data.length, 1);
    assert.equal(approvedPayouts.payload.data[0].payoutAmount, '1600');
    assert.equal(approvedPayouts.payload.data[0].estimated, true);
    await request(`/payouts/${approvedPayouts.payload.data[0].id}/status`, {
      token: admin,
      method: 'PATCH',
      body: { status: 'PROCESSING', note: 'Must wait for disbursal' },
      expected: 409,
    });
    const body = { status: 'DISBURSED', lenderId, disbursedAmount: 100000, remarks: 'Disbursed' };
    const disbursed = await request(`/applications/${application.id}/status`, { token: admin, method: 'PATCH', body });
    assert.equal(disbursed.payload.data.payout.payoutAmount, '1600');
    const confirmedPayouts = await request(`/payouts?applicationId=${application.id}`, { token: advisor });
    assert.equal(confirmedPayouts.payload.data.length, 1);
    assert.equal(confirmedPayouts.payload.data[0].estimated, false);
    await request(`/applications/${application.id}/status`, { token: admin, method: 'PATCH', body, expected: 409 });
    const count = await prisma.payout.count({ where: { applicationId: application.id } });
    assert.equal(count, 1);
  });

  await t.test('login throttling activates after repeated failures', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request('/auth/login', { method: 'POST', body: { identifier: `missing-${stamp}@example.test`, password: 'wrong', remember: false }, expected: 401 });
    }
    await request('/auth/login', { method: 'POST', body: { identifier: `missing-${stamp}@example.test`, password: 'wrong', remember: false }, expected: 429 });
  });
});

test.after(async () => {
  server.close();
  await once(server, 'close');
  await prisma.$disconnect();
});
