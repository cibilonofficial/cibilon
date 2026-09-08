import 'dotenv/config';
import { prisma } from '../server/src/lib/prisma.js';
import { DOCUMENTATION_DATA } from '../src/data/documentationData.js';

const serviceSources: Record<string, string[]> = {
  'Personal Loan': ['personal-loan'], 'Business Loan': ['business-loan'], 'Home Loan': ['home-loan'],
  'Loan Against Property': ['lap'], 'Vehicle Loan': ['car-loan'], Insurance: ['life-insurance', 'health-insurance'],
};

for (const [serviceType, sourceIds] of Object.entries(serviceSources)) {
  const product = await prisma.product.findUnique({ where: { serviceType }, select: { id: true } });
  if (!product) continue;
  const byName = new Map<string, { name: string; required: boolean }>();
  DOCUMENTATION_DATA.filter((category) => sourceIds.includes(category.id)).forEach((category) =>
    category.variants.forEach((variant) => variant.sections.forEach((section) => section.items.forEach((item) => {
      const key = item.name.trim().toLowerCase();
      const current = byName.get(key);
      byName.set(key, { name: item.name.trim(), required: Boolean(item.mandatory || current?.required) });
    }))));
  const documents = [...byName.values()].map((item, sortOrder) => ({
    productId: product.id, documentType: `reference_${sortOrder + 1}`, displayName: item.name,
    required: item.required, sortOrder,
  }));
  await prisma.$transaction(async (tx) => {
    await tx.productDocument.deleteMany({ where: { productId: product.id } });
    if (documents.length) await tx.productDocument.createMany({ data: documents });
  });
  console.log(`${serviceType}: ${documents.length} document requirements synchronized.`);
}
await prisma.$disconnect();
