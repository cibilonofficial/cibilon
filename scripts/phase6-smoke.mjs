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

async function login(identifier) {
  const payload = await request('/auth/login', {
    method: 'POST',
    body: { identifier, password, remember: false },
  });
  return payload.data.accessToken;
}

const admin = await login('admin@cibilon.in');
const advisor = await login('advisor@cibilon.in');
const staff = await login('staff@cibilon.in');

const activeLenders = await request('/lenders?status=ACTIVE&pageSize=100', { token: admin });
const lender = activeLenders.data.find((item) => item.name === 'HDFC Bank') ?? activeLenders.data[0];
assert(lender);
const staffList = await request('/staff?search=EMP-DEMO-001', { token: admin });
assert.equal(staffList.data.length, 1);
const staffId = staffList.data[0].id;

const stamp = Date.now();
const lead = await request('/leads', {
  token: advisor,
  method: 'POST',
  expected: 201,
  body: {
    customer: {
      fullName: `Phase Six Customer ${stamp}`,
      mobile: `7${String(stamp).slice(-9)}`,
      email: `phase6.customer.${stamp}@example.test`,
      dateOfBirth: '1990-01-15',
      gender: 'OTHER',
      pan: 'FGHIJ5678K',
      aadhaar: `9${String(stamp).slice(-11)}`,
      addressLine: '123 Phase Six Test Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
    },
    serviceType: 'Personal Loan',
    requestedAmount: 100000,
    employment: {
      employmentType: 'Salaried',
      monthlyIncome: 75000,
      organisation: 'Phase Six Labs',
      experience: '5 years',
      existingLoans: 'No',
      bankName: 'HDFC Bank',
      accountNumber: '123456789012',
      ifsc: 'HDFC0001234',
    },
    serviceDetails: { tenure: '24 months', purpose: 'Phase 6 integration test' },
    source: 'Phase 6 smoke test',
  },
});
const application = await request(`/leads/${lead.data.id}/convert`, {
  token: advisor,
  method: 'POST',
  expected: 201,
  body: { remarks: 'Phase 6 payout test' },
});

for (const status of ['UNDER_REVIEW', 'SENT_TO_LENDER', 'LENDER_PROCESSING', 'APPROVED']) {
  await request(`/applications/${application.data.id}/status`, {
    token: admin,
    method: 'PATCH',
    body: { status, remarks: `Advanced to ${status}` },
  });
}
await request(`/applications/${application.data.id}/status`, {
  token: admin,
  method: 'PATCH',
  expected: 422,
  body: { status: 'DISBURSED', remarks: 'Missing disbursal facts' },
});
const disbursed = await request(`/applications/${application.data.id}/status`, {
  token: admin,
  method: 'PATCH',
  body: { status: 'DISBURSED', lenderId: lender.id, disbursedAmount: 100000, remarks: 'Disbursed in full' },
});
assert.equal(disbursed.data.status, 'DISBURSED');
assert.equal(disbursed.data.payout.status, 'PENDING');
assert.equal(disbursed.data.payout.payoutAmount, '1600');
const payoutId = disbursed.data.payout.id;

await request(`/applications/${application.data.id}/status`, {
  token: admin,
  method: 'PATCH',
  expected: 409,
  body: { status: 'DISBURSED', lenderId: lender.id, disbursedAmount: 100000 },
});
const advisorPayouts = await request(`/payouts?applicationId=${application.data.id}`, { token: advisor });
assert.equal(advisorPayouts.data.length, 1);
assert.equal(advisorPayouts.data[0].commissionVersion, 1);
assert(advisorPayouts.data[0].commissionRuleId);

await request(`/payouts/${payoutId}/status`, {
  token: staff,
  method: 'PATCH',
  expected: 422,
  body: { status: 'PAID' },
});
await request('/payouts/bulk/process', {
  token: staff,
  method: 'POST',
  body: { payoutIds: [payoutId], note: 'Included in Phase 6 payout run' },
});
await request('/payouts/bulk/pay', {
  token: staff,
  method: 'POST',
  body: {
    payments: [{ payoutId, paymentReference: `UTR-PHASE6-${stamp}`, paymentMethod: 'NEFT' }],
    note: 'Phase 6 test payment',
  },
});
const paid = await request(`/payouts/${payoutId}`, { token: advisor });
assert.equal(paid.data.status, 'PAID');
assert.equal(paid.data.paymentReference, `UTR-PHASE6-${stamp}`);
assert.equal(paid.data.statusHistory.length, 3);

const ticket = await request('/support/tickets', {
  token: advisor,
  method: 'POST',
  expected: 201,
  body: {
    subject: 'Question about Phase 6 payout',
    category: 'PAYOUT_QUERY',
    priority: 'HIGH',
    applicationId: application.data.id,
    payoutId,
    message: 'Please confirm the payment reference.',
  },
});
assert.equal(ticket.data.advisor.id, disbursed.data.advisor.id);

await request(`/support/tickets/${ticket.data.id}`, {
  token: staff,
  method: 'PATCH',
  body: { status: 'IN_PROGRESS', assignedStaffId: staffId, note: 'Taking ownership of this query.' },
});
await request(`/support/tickets/${ticket.data.id}/messages`, {
  token: staff,
  method: 'POST',
  expected: 201,
  body: { body: 'Internal payment verification completed.', internal: true },
});
await request(`/support/tickets/${ticket.data.id}/messages`, {
  token: staff,
  method: 'POST',
  expected: 201,
  body: { body: 'The payment reference is confirmed.', internal: false },
});
const advisorTicket = await request(`/support/tickets/${ticket.data.id}`, { token: advisor });
assert.equal(advisorTicket.data.messages.some((message) => message.internal), false);
const staffTicket = await request(`/support/tickets/${ticket.data.id}`, { token: staff });
assert.equal(staffTicket.data.messages.some((message) => message.internal), true);
await request(`/support/tickets/${ticket.data.id}`, {
  token: staff,
  method: 'PATCH',
  body: { status: 'RESOLVED', note: 'Payment reference confirmed with the advisor.' },
});

const advisorNotifications = await request('/notifications?isRead=false&pageSize=100', { token: advisor });
assert(advisorNotifications.data.some((item) => item.payoutId === payoutId && item.type === 'PAYOUT_ACTION'));
assert(advisorNotifications.data.some((item) => item.ticketId === ticket.data.id && item.type === 'SUPPORT_ACTION'));
const notification = advisorNotifications.data.find((item) => item.ticketId === ticket.data.id);
await request(`/notifications/${notification.id}`, { token: staff, method: 'PATCH', body: { isRead: true }, expected: 404 });
await request(`/notifications/${notification.id}`, { token: advisor, method: 'PATCH', body: { isRead: true } });
await request(`/notifications/${notification.id}`, { token: advisor, method: 'PATCH', body: { isRead: false } });
await request('/notifications/read-all', { token: advisor, method: 'PATCH' });
const noUnread = await request('/notifications?isRead=false', { token: advisor });
assert.equal(noUnread.unread, 0);

const audit = await request('/audit-logs?action=PAYOUTS_BULK_PAID&pageSize=100', { token: admin });
assert(audit.data.some((entry) => entry.action === 'PAYOUTS_BULK_PAID'));
const ticketAudit = await request('/audit-logs?action=SUPPORT_TICKET_UPDATED&pageSize=100', { token: admin });
assert(ticketAudit.data.some((entry) => entry.action === 'SUPPORT_TICKET_UPDATED'));

console.log(`Phase 6 smoke test passed (${checks} API checks).`);
