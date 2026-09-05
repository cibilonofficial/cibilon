import 'dotenv/config';
import assert from 'node:assert/strict';

const baseUrl = `http://${process.env.API_HOST ?? '127.0.0.1'}:${process.env.API_PORT ?? '4000'}/api/v1`;
const password = process.env.SEED_DEFAULT_PASSWORD;
assert(password, 'SEED_DEFAULT_PASSWORD is required');

let checks = 0;

async function request(path, { token, method = 'GET', body, expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${text}`);
  checks += 1;
  return payload;
}

async function login(identifier, loginPassword = password, expected = 200) {
  const payload = await request('/auth/login', {
    method: 'POST',
    body: { identifier, password: loginPassword, remember: false },
    expected,
  });
  return payload?.data?.accessToken;
}

const admin = await login('admin@cibilon.in');
const advisor = await login('advisor@cibilon.in');
const seededStaff = await login('staff@cibilon.in');
assert(admin && advisor && seededStaff);

const products = await request('/products?pageSize=100', { token: advisor });
assert.equal(products.data.length, 8);
assert(products.data.every((product) => product.documents.length > 0));
const lenders = await request('/lenders?pageSize=100', { token: advisor });
assert(lenders.data.length >= 3);
await request('/lenders', {
  token: advisor,
  method: 'POST',
  body: { name: 'Forbidden Advisor Lender', type: 'BANK' },
  expected: 403,
});

await request('/advisors/me', {
  token: advisor,
  method: 'PATCH',
  body: { pan: 'ABCDE1234F', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
});
const bank = await request('/advisors/me/bank-account', {
  token: advisor,
  method: 'PUT',
  body: { accountHolder: 'Demo Advisor', bankName: 'Test Bank', accountNumber: '123456789012', ifsc: 'HDFC0001234' },
});
assert.equal(bank.data.accountNumberMasked, '••••9012');
assert.equal(bank.data.accountNumberEncrypted, undefined);
const ownSensitive = await request('/advisors/me/sensitive', { token: advisor });
assert.equal(ownSensitive.data.pan, 'ABCDE1234F');
assert.equal(ownSensitive.data.bankAccount.accountNumber, '123456789012');

const advisorList = await request('/advisors?search=DSA-DEMO-001', { token: admin });
assert.equal(advisorList.data.length, 1);
const advisorId = advisorList.data[0].id;
assert.equal(advisorList.data[0].pan, undefined);
assert.equal(advisorList.data[0].panMasked, '••••234F');
await request(`/advisors/${advisorId}/bank-account/status`, {
  token: admin,
  method: 'PATCH',
  body: { status: 'REJECTED' },
  expected: 422,
});
await request(`/advisors/${advisorId}/bank-account/status`, {
  token: admin,
  method: 'PATCH',
  body: { status: 'VERIFIED' },
});
const adminSensitive = await request(`/advisors/${advisorId}/sensitive`, { token: admin });
assert.equal(adminSensitive.data.pan, 'ABCDE1234F');

const stamp = Date.now();
const staffEmail = `phase5.staff.${stamp}@cibilon.in`;
const staffPassword = 'Phase5Test!234';
const createdStaff = await request('/staff', {
  token: admin,
  method: 'POST',
  expected: 201,
  body: {
    name: 'Phase Five Test Staff',
    email: staffEmail,
    mobile: `+918${String(stamp).slice(-9)}`,
    code: `P5-${String(stamp).slice(-8)}`,
    department: 'Testing',
    role: 'CREDIT_ANALYST',
    password: staffPassword,
    permissionCodes: [],
  },
});
let limitedStaff = await login(staffEmail, staffPassword);
await request('/staff/me', { token: limitedStaff });
await request('/lenders', {
  token: limitedStaff,
  method: 'POST',
  body: { name: `Blocked Lender ${stamp}`, type: 'NBFC' },
  expected: 403,
});
await request(`/staff/${createdStaff.data.id}/permissions`, {
  token: admin,
  method: 'PUT',
  body: { permissionCodes: ['audit:read', 'lenders:manage'] },
});
limitedStaff = await login(staffEmail, staffPassword);
await request('/audit-logs?pageSize=1', { token: limitedStaff });
await request('/lenders', {
  token: limitedStaff,
  method: 'POST',
  body: { name: `Still Blocked Lender ${stamp}`, type: 'NBFC' },
  expected: 403,
});
const testLender = await request('/lenders', {
  token: admin,
  method: 'POST',
  expected: 201,
  body: { name: `Phase 5 Test Lender ${stamp}`, type: 'FINTECH', turnaroundDays: 2, city: 'Bengaluru' },
});

const product = products.data.find((item) => item.serviceType === 'Personal Loan');
assert(product);
const originalMappings = product.lenders
  .filter(({ lender }) => lender.status !== 'INACTIVE')
  .map(({ lenderId, active, turnaroundDays }) => ({ lenderId, active, turnaroundDays }));
await request(`/products/${product.id}`, {
  token: admin,
  method: 'PATCH',
  body: { tagline: 'Phase 5 verified configuration', minAmount: 50000, maxAmount: 5000000, turnaroundDays: 4 },
});
await request(`/products/${product.id}/lenders`, {
  token: admin,
  method: 'PUT',
  body: { mappings: [...originalMappings, { lenderId: testLender.data.id, active: true, turnaroundDays: 2 }] },
});

const firstEffective = new Date(Date.now() + 60_000);
const firstRule = await request(`/products/${product.id}/commission-rules`, {
  token: admin,
  method: 'POST',
  expected: 201,
  body: { lenderId: testLender.data.id, calculationType: 'PERCENTAGE', percentageRate: 1.25, effectiveFrom: firstEffective.toISOString() },
});
const secondRule = await request(`/products/${product.id}/commission-rules`, {
  token: admin,
  method: 'POST',
  expected: 201,
  body: { lenderId: testLender.data.id, calculationType: 'PERCENTAGE', percentageRate: 1.5, effectiveFrom: new Date(firstEffective.getTime() + 86_400_000).toISOString() },
});
assert.equal(firstRule.data.version, 1);
assert.equal(secondRule.data.version, 2);
const versions = await request(`/products/${product.id}/commission-rules?lenderId=${testLender.data.id}`, { token: admin });
assert.equal(versions.data.length, 2);
assert.equal(versions.data[0].active, true);
assert.equal(versions.data[1].active, false);
assert.equal(versions.data[1].effectiveTo, secondRule.data.effectiveFrom);

await request(`/lenders/${testLender.data.id}`, { token: admin, method: 'DELETE', expected: 204 });
const deactivatedLender = await request(`/lenders/${testLender.data.id}`, { token: limitedStaff });
assert.equal(deactivatedLender.data.status, 'INACTIVE');
await request(`/staff/${createdStaff.data.id}/status`, {
  token: admin,
  method: 'PATCH',
  body: { status: 'INACTIVE', reason: 'Phase 5 smoke test complete' },
});
await login(staffEmail, staffPassword, 403);

const audit = await request(`/audit-logs?entityType=advisor&entityId=${advisorId}&pageSize=100`, { token: admin });
assert(audit.data.some((entry) => entry.action === 'ADVISOR_SENSITIVE_DATA_ACCESSED'));

console.log(`Phase 5 smoke test passed (${checks} API checks).`);
