import 'dotenv/config';
import { prisma } from '../server/src/lib/prisma.js';
import { PAYOUT_DATA, CIBILON_CONTACT } from '../src/data/payoutStructureData.js';

const entries = PAYOUT_DATA.flatMap((category) => category.items.map((item, index) => ({
  sourceKey: item.id,
  categoryId: category.id,
  categoryName: category.name,
  providerName: item.lender,
  productName: item.product,
  payoutText: item.payout,
  percentageRate: item.numericRate ?? null,
  notes: item.notes ?? null,
  sortOrder: index,
  effectiveMonth: category.cycle || CIBILON_CONTACT.effectiveMonth,
})));

await prisma.$transaction(async (tx) => {
  await tx.payoutRateCardEntry.deleteMany();
  await tx.payoutRateCardEntry.createMany({ data: entries });
});

console.log(`Payout structure synchronized: ${entries.length} rows.`);
await prisma.$disconnect();
