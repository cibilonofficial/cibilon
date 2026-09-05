import 'dotenv/config';
import assert from 'node:assert/strict';

const baseUrl = `http://${process.env.API_HOST ?? '127.0.0.1'}:${process.env.API_PORT ?? '4000'}/api/v1`;
const password = process.env.SEED_DEFAULT_PASSWORD;
assert(password);
let checks = 0;

async function request(path, { token, method = 'GET', body, expected = 200, binary = false } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const content = binary ? Buffer.from(await response.arrayBuffer()) : await response.text();
  const payload = binary || !content ? content : JSON.parse(content);
  assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${binary ? '' : content}`);
  checks += 1;
  return payload;
}

async function login(identifier) {
  return (await request('/auth/login', { method: 'POST', body: { identifier, password, remember: false } })).data.accessToken;
}

async function waitForJob(id, token) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const job = await request(`/reports/exports/${id}`, { token });
    if (job.data.status === 'COMPLETED') return job.data;
    if (job.data.status === 'FAILED') throw new Error(job.data.errorMessage);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Export job ${id} did not complete`);
}

const admin = await login('admin@cibilon.in');
const advisor = await login('advisor@cibilon.in');

const adminDashboard = await request('/reports/dashboard/admin', { token: admin });
assert(adminDashboard.data.metrics.applications > 0);
assert(Array.isArray(adminDashboard.data.statusDistribution));
const advisorDashboard = await request('/reports/dashboard/advisor', { token: advisor });
assert(advisorDashboard.data.metrics.applications > 0);
await request('/reports/dashboard/admin', { token: advisor, expected: 403 });

const applications = await request('/reports/applications?serviceType=Personal%20Loan&pageSize=100', { token: advisor });
assert(applications.data.every((item) => item.serviceType === 'Personal Loan'));
const payouts = await request('/reports/payouts?pageSize=100', { token: advisor });
assert(payouts.data.length > 0);
const advisors = await request('/reports/advisors?pageSize=100', { token: admin });
assert(advisors.data.some((item) => item.code === 'DSA-DEMO-001'));
const lenders = await request('/reports/lenders?pageSize=100', { token: admin });
assert(lenders.data.some((item) => item.name === 'HDFC Bank'));
await request('/reports/lenders', { token: advisor, expected: 403 });

const search = await request('/search?q=Phase%20Six&limit=20', { token: advisor });
assert((search.data.groups.applications?.length ?? 0) > 0 || (search.data.groups.customers?.length ?? 0) > 0);
assert.equal(search.data.groups.advisors, undefined);
const adminSearch = await request('/search?q=HDFC&limit=20', { token: admin });
assert((adminSearch.data.groups.lenders?.length ?? 0) > 0);

const csvJob = await request('/reports/exports', {
  token: admin,
  method: 'POST',
  expected: 202,
  body: { reportType: 'APPLICATIONS', format: 'CSV', filters: { serviceType: 'Personal Loan' } },
});
const completedCsv = await waitForJob(csvJob.data.id, admin);
assert(completedCsv.rowCount > 0);
const csv = await request(`/reports/exports/${csvJob.data.id}/download`, { token: admin, binary: true });
assert(csv.toString('utf8').includes('applicationNumber'));
await request(`/reports/exports/${csvJob.data.id}`, { token: advisor, expected: 404 });

const pdfJob = await request('/reports/exports', {
  token: admin,
  method: 'POST',
  expected: 202,
  body: { reportType: 'LENDERS', format: 'PDF', filters: {} },
});
await waitForJob(pdfJob.data.id, admin);
const pdf = await request(`/reports/exports/${pdfJob.data.id}/download`, { token: admin, binary: true });
assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.4');

const jobs = await request('/reports/exports?pageSize=100', { token: admin });
assert(jobs.data.some((item) => item.id === csvJob.data.id && item.filePath === undefined));
const notifications = await request('/notifications?type=REPORT_ACTION&pageSize=100', { token: admin });
assert(notifications.data.some((item) => item.type === 'REPORT_ACTION'));

console.log(`Phase 7 backend smoke test passed (${checks} API checks).`);
