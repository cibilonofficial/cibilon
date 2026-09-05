import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserStatus } from '../server/generated/prisma/client.js';
import { DOCUMENT_CHECKLISTS, SERVICE_TYPES } from '../server/src/common/domain.js';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DIRECT_URL or DATABASE_URL is required for seeding');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const permissionDescriptions: Record<string, string> = {
  'users:create': 'Create internal users',
  'users:read': 'Read users',
  'users:update': 'Update users',
  'audit:read': 'Read audit logs',
  'customers:create': 'Create customers',
  'customers:read:self': 'Read owned customers',
  'customers:read:any': 'Read all customers',
  'customers:update:self': 'Update owned customers',
  'customers:update:any': 'Update all customers',
  'leads:create': 'Create leads',
  'leads:read:self': 'Read owned leads',
  'leads:read:any': 'Read all leads',
  'leads:update:self': 'Update owned leads',
  'leads:update:any': 'Update all leads',
  'applications:read:self': 'Read owned applications',
  'applications:read:any': 'Read all applications',
  'applications:status:update': 'Change application status',
  'applications:assign': 'Assign applications to staff',
  'applications:remarks:create': 'Add application remarks',
  'applications:activity:create': 'Add application activities',
  'applications:workload:read': 'Read staff application workloads',
  'documents:read:self': 'Read documents for owned applications',
  'documents:read:any': 'Read all application documents',
  'documents:upload:self': 'Upload documents for owned applications',
  'documents:upload:any': 'Upload documents for any application',
  'documents:request': 'Request additional application documents',
  'documents:verify': 'Verify or reject documents',
  'advisors:read:self': 'Read own advisor profile',
  'advisors:update:self': 'Update own advisor profile and bank account',
  'advisors:sensitive:read:self': 'Read own unmasked advisor sensitive data',
  'advisors:read:any': 'Read all advisor profiles',
  'advisors:create': 'Create advisors',
  'advisors:update:any': 'Update any advisor profile',
  'advisors:status:update': 'Activate, suspend, or deactivate advisors',
  'advisors:bank:verify': 'Verify or reject advisor bank accounts',
  'advisors:sensitive:read:any': 'Read any unmasked advisor sensitive data',
  'staff:read:any': 'Read staff profiles and workloads',
  'staff:manage': 'Create and manage staff, status, and permissions',
  'lenders:read': 'Read lender configuration',
  'lenders:manage': 'Manage lender configuration',
  'products:read': 'Read product, eligibility, document, and lender configuration',
  'products:manage': 'Manage product and commission configuration',
  'payouts:read:self': 'Read own advisor payouts',
  'payouts:read:any': 'Read all advisor payouts',
  'payouts:manage': 'Manage payout processing',
  'support:create:self': 'Create own advisor support tickets',
  'support:read:self': 'Read own advisor support tickets',
  'support:message:self': 'Reply to own advisor support tickets',
  'support:read:any': 'Read all support tickets',
  'support:manage': 'Manage support tickets',
  'reports:read:self': 'Read own advisor dashboards and reports',
  'reports:read:any': 'Read network dashboards and reports',
  'reports:export': 'Create and download report exports',
};

const roleDefinitions = [
  {
    slug: 'admin',
    name: 'Administrator',
    description: 'Full Cibilon administration access',
    permissions: Object.keys(permissionDescriptions),
  },
  {
    slug: 'advisor',
    name: 'Advisor',
    description: 'DSA/advisor access restricted to owned records',
    permissions: [
      'leads:create',
      'customers:create',
      'customers:read:self',
      'customers:update:self',
      'leads:read:self',
      'leads:update:self',
      'applications:read:self',
      'applications:remarks:create',
      'applications:activity:create',
      'documents:read:self',
      'documents:upload:self',
      'advisors:read:self',
      'advisors:update:self',
      'advisors:sensitive:read:self',
      'lenders:read',
      'products:read',
      'payouts:read:self',
      'support:create:self',
      'support:read:self',
      'support:message:self',
      'reports:read:self',
      'reports:export',
    ],
  },
  {
    slug: 'staff',
    name: 'Operations Staff',
    description: 'Assigned application processing access',
    permissions: [
      'applications:read:any',
      'documents:read:any',
      'lenders:read',
      'products:read',
    ],
  },
] as const;

async function seedRoles() {
  for (const [code, description] of Object.entries(permissionDescriptions)) {
    await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description },
    });
  }

  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { slug: definition.slug },
      update: { name: definition.name, description: definition.description, isSystem: true },
      create: {
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
        isSystem: true,
      },
    });
    const permissions = await prisma.permission.findMany({
      where: { code: { in: [...definition.permissions] } },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    });
  }
}

interface SeedUser {
  email: string;
  mobile: string;
  name: string;
  role: 'admin' | 'advisor' | 'staff';
  code?: string;
  agency?: string;
  department?: string;
}

async function ensureUser(input: SeedUser, passwordHash: string) {
  const role = await prisma.role.findUniqueOrThrow({ where: { slug: input.role } });
  let user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: input.email,
        mobile: input.mobile,
        name: input.name,
        passwordHash,
        status: UserStatus.ACTIVE,
      },
    });
  }
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
  if (input.role === 'advisor') {
    await prisma.advisor.upsert({
      where: { userId: user.id },
      update: { code: input.code!, agency: input.agency },
      create: { userId: user.id, code: input.code!, agency: input.agency },
    });
  }
  if (input.role === 'staff') {
    await prisma.staff.upsert({
      where: { userId: user.id },
      update: { code: input.code!, department: input.department, role: 'OPERATIONS_MANAGER' },
      create: { userId: user.id, code: input.code!, department: input.department, role: 'OPERATIONS_MANAGER' },
    });
  }
  return user;
}

const demoStaffPermissions = [
  'applications:status:update',
  'applications:remarks:create',
  'applications:activity:create',
  'documents:upload:any',
  'documents:request',
  'documents:verify',
] as const;

async function seedDemoStaffPermissions(userId: string) {
  const permissions = await prisma.permission.findMany({
    where: { code: { in: [...demoStaffPermissions] } },
    select: { id: true },
  });
  await prisma.userPermission.deleteMany({ where: { userId } });
  await prisma.userPermission.createMany({
    data: permissions.map((permission) => ({ userId, permissionId: permission.id })),
  });
}

const productDefaults: Record<(typeof SERVICE_TYPES)[number], { tagline: string; eligibility: string[]; commission: number; flat?: boolean }> = {
  'Personal Loan': { tagline: 'Flexible unsecured finance for personal needs', eligibility: ['Indian resident aged 21–60', 'Stable monthly income', 'Credit assessment required'], commission: 1.6 },
  'Business Loan': { tagline: 'Working capital and growth finance for businesses', eligibility: ['Business vintage of at least 12 months', 'Valid business registration', 'Banking and tax records required'], commission: 1.8 },
  'Home Loan': { tagline: 'Long-term finance for residential property', eligibility: ['Indian resident aged 21–65', 'Documented repayment capacity', 'Eligible residential property'], commission: 0.6 },
  'Loan Against Property': { tagline: 'Secured finance against residential or commercial property', eligibility: ['Clear property title', 'Documented repayment capacity', 'Property valuation required'], commission: 0.9 },
  'Vehicle Loan': { tagline: 'Finance for new and eligible used vehicles', eligibility: ['Indian resident aged 21–65', 'Valid income proof', 'Eligible vehicle and invoice'], commission: 1.2 },
  'Credit Card': { tagline: 'Cards selected for spending and lifestyle needs', eligibility: ['Indian resident aged 18 or above', 'Income and credit assessment required'], commission: 2500, flat: true },
  Insurance: { tagline: 'Protection plans for life, health, and assets', eligibility: ['Valid identity and address proof', 'Underwriting requirements apply'], commission: 4500, flat: true },
  'Other Financial Services': { tagline: 'Additional financial solutions tailored to customer needs', eligibility: ['Eligibility depends on the selected service'], commission: 1 },
};

async function seedCatalog(adminUserId: string) {
  const lenderDefinitions = [
    { name: 'HDFC Bank', type: 'BANK' as const, turnaroundDays: 5, city: 'Mumbai' },
    { name: 'ICICI Bank', type: 'BANK' as const, turnaroundDays: 6, city: 'Mumbai' },
    { name: 'Bajaj Finance', type: 'NBFC' as const, turnaroundDays: 3, city: 'Pune' },
  ];
  const lenders = [];
  for (const definition of lenderDefinitions) {
    lenders.push(await prisma.lender.upsert({ where: { name: definition.name }, update: {}, create: definition }));
  }

  for (const serviceType of SERVICE_TYPES) {
    const defaults = productDefaults[serviceType];
    const product = await prisma.product.upsert({
      where: { serviceType },
      update: {},
      create: { serviceType, tagline: defaults.tagline, turnaroundDays: 7 },
    });
    if ((await prisma.productEligibility.count({ where: { productId: product.id } })) === 0) {
      await prisma.productEligibility.createMany({
        data: defaults.eligibility.map((rule, sortOrder) => ({ productId: product.id, rule, sortOrder })),
      });
    }
    if ((await prisma.productDocument.count({ where: { productId: product.id } })) === 0) {
      await prisma.productDocument.createMany({
        data: DOCUMENT_CHECKLISTS[serviceType].map((document, sortOrder) => ({ productId: product.id, ...document, sortOrder })),
      });
    }
    for (const lender of lenders) {
      await prisma.productLender.upsert({
        where: { productId_lenderId: { productId: product.id, lenderId: lender.id } },
        update: {},
        create: { productId: product.id, lenderId: lender.id, turnaroundDays: lender.turnaroundDays },
      });
    }
    if ((await prisma.commissionRule.count({ where: { productId: product.id, lenderId: null } })) === 0) {
      await prisma.commissionRule.create({
        data: {
          productId: product.id,
          version: 1,
          calculationType: defaults.flat ? 'FLAT' : 'PERCENTAGE',
          percentageRate: defaults.flat ? null : defaults.commission,
          flatAmount: defaults.flat ? defaults.commission : null,
          effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
          createdByUserId: adminUserId,
        },
      });
    }
  }
}

async function main() {
  await seedRoles();
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!defaultPassword) throw new Error('SEED_DEFAULT_PASSWORD is required for seeding');
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  const admin = await ensureUser(
    {
      email: 'admin@cibilon.in',
      mobile: '+919000000001',
      name: 'Cibilon Administrator',
      role: 'admin',
    },
    passwordHash,
  );
  await ensureUser(
    {
      email: 'advisor@cibilon.in',
      mobile: '+919000000002',
      name: 'Demo Advisor',
      role: 'advisor',
      code: 'DSA-DEMO-001',
      agency: 'Demo Financial Services',
    },
    passwordHash,
  );
  const staff = await ensureUser(
    {
      email: 'staff@cibilon.in',
      mobile: '+919000000003',
      name: 'Demo Operations Staff',
      role: 'staff',
      code: 'EMP-DEMO-001',
      department: 'Operations',
    },
    passwordHash,
  );
  await seedDemoStaffPermissions(staff.id);
  await seedCatalog(admin.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
