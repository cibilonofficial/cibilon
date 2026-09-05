#!/usr/bin/env node
/** Create missing estimated payouts for applications that were approved before this workflow existed. */
import 'dotenv/config';

const { prisma } = await import('../server/src/lib/prisma.js');
const { createPayoutForApproval } = await import('../server/src/modules/payouts/payout.service.js');

const approved = await prisma.application.findMany({
  where: { status: 'APPROVED', payout: null },
  include: { advisor: { select: { userId: true } } },
  orderBy: { createdAt: 'asc' },
});

const admin = await prisma.user.findFirst({
  where: { userRoles: { some: { role: { slug: 'admin' } } } },
  select: { id: true },
});

if (!admin && approved.length > 0) {
  throw new Error('No admin account exists to attribute payout history');
}

let created = 0;
const skipped = [];

for (const application of approved) {
  const snapshot = application.serviceSnapshot && typeof application.serviceSnapshot === 'object'
    ? application.serviceSnapshot
    : {};
  const preferredLender = typeof snapshot.preferredLender === 'string'
    ? snapshot.preferredLender.trim()
    : '';

  const product = await prisma.product.findUnique({
    where: { serviceType: application.serviceType },
    include: {
      lenders: {
        where: { active: true, lender: { status: 'ACTIVE' } },
        include: { lender: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  const preferred = product?.lenders.find(
    (mapping) => mapping.lender.name.localeCompare(preferredLender, undefined, { sensitivity: 'accent' }) === 0,
  );
  const lenderId = application.lenderId ?? preferred?.lender.id ?? product?.lenders[0]?.lender.id;

  if (!lenderId) {
    skipped.push(application.applicationNumber);
    continue;
  }

  await prisma.$transaction(async (tx) => {
    if (!application.lenderId) {
      await tx.application.update({ where: { id: application.id }, data: { lenderId } });
    }
    await createPayoutForApproval(tx, application, lenderId, admin.id, new Date());
  });
  created += 1;
}

console.log(`Created ${created} missing approved payout estimate(s).`);
if (skipped.length > 0) {
  console.log(`Skipped ${skipped.length} application(s) without an active product lender: ${skipped.join(', ')}`);
  process.exitCode = 1;
}

await prisma.$disconnect();
