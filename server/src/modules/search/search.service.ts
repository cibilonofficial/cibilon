import { prisma } from '../../lib/prisma.js';
import type { RequestUser } from '../../types/express.js';
import type { GlobalSearchQuery } from './search.schemas.js';

export async function globalSearch(query: GlobalSearchQuery, user: RequestUser) {
  const restrictedStaff = user.staffId && !user.roles.includes('admin');
  const requested = new Set(restrictedStaff ? ['applications'] : query.types ?? ['customers', 'leads', 'applications', 'payouts', 'tickets', 'advisors', 'lenders', 'products']);
  const ownAdvisor = user.advisorId;
  const can = (permission: string) => user.permissions.includes(permission);
  const noAdvisor = '00000000-0000-0000-0000-000000000000';
  const searches: Record<string, Promise<unknown[]>> = {};

  if (requested.has('customers') && (can('customers:read:self') || can('customers:read:any'))) {
    searches.customers = prisma.customer.findMany({
      where: {
        ...(can('customers:read:any') ? {} : { advisorId: ownAdvisor ?? noAdvisor }), archivedAt: null,
        OR: [{ fullName: { contains: query.q, mode: 'insensitive' } }, { email: { contains: query.q, mode: 'insensitive' } }, { mobile: { contains: query.q } }],
      },
      select: { id: true, fullName: true, email: true, mobile: true, city: true, advisorId: true }, take: query.limit,
    });
  }
  if (requested.has('leads') && (can('leads:read:self') || can('leads:read:any'))) {
    searches.leads = prisma.lead.findMany({
      where: {
        ...(can('leads:read:any') ? {} : { advisorId: ownAdvisor ?? noAdvisor }), status: { not: 'ARCHIVED' },
        OR: [{ customer: { fullName: { contains: query.q, mode: 'insensitive' } } }, { customer: { mobile: { contains: query.q } } }, { serviceType: { contains: query.q, mode: 'insensitive' } }],
      },
      select: { id: true, status: true, stage: true, serviceType: true, advisorId: true, customer: { select: { fullName: true } } }, take: query.limit,
    });
  }
  if (requested.has('applications') && (can('applications:read:self') || can('applications:read:any'))) {
    searches.applications = prisma.application.findMany({
      where: {
        ...(can('applications:read:any') ? {} : { advisorId: ownAdvisor ?? noAdvisor }),
        ...(restrictedStaff ? { assignedStaffId: user.staffId } : {}),
        OR: [{ applicationNumber: { contains: query.q, mode: 'insensitive' } }, { customer: { fullName: { contains: query.q, mode: 'insensitive' } } }, { serviceType: { contains: query.q, mode: 'insensitive' } }],
      },
      select: { id: true, applicationNumber: true, status: true, serviceType: true, advisorId: true, customer: { select: { fullName: true } } }, take: query.limit,
    });
  }
  if (requested.has('payouts') && (can('payouts:read:self') || can('payouts:read:any'))) {
    searches.payouts = prisma.payout.findMany({
      where: {
        ...(can('payouts:read:any') ? {} : { advisorId: ownAdvisor ?? noAdvisor }),
        OR: [{ payoutNumber: { contains: query.q, mode: 'insensitive' } }, { paymentReference: { contains: query.q, mode: 'insensitive' } }, { application: { applicationNumber: { contains: query.q, mode: 'insensitive' } } }],
      },
      select: { id: true, payoutNumber: true, status: true, payoutAmount: true, advisorId: true, applicationId: true }, take: query.limit,
    }).then((items) => items.map((item) => ({ ...item, payoutAmount: item.payoutAmount.toString() })));
  }
  if (requested.has('tickets') && (can('support:read:self') || can('support:read:any'))) {
    searches.tickets = prisma.supportTicket.findMany({
      where: {
        ...(can('support:read:any') ? {} : { advisorId: ownAdvisor ?? noAdvisor }),
        OR: [{ ticketNumber: { contains: query.q, mode: 'insensitive' } }, { subject: { contains: query.q, mode: 'insensitive' } }],
      },
      select: { id: true, ticketNumber: true, subject: true, status: true, priority: true, advisorId: true }, take: query.limit,
    });
  }
  if (requested.has('advisors') && can('advisors:read:any')) {
    searches.advisors = prisma.advisor.findMany({
      where: { OR: [{ code: { contains: query.q, mode: 'insensitive' } }, { agency: { contains: query.q, mode: 'insensitive' } }, { user: { name: { contains: query.q, mode: 'insensitive' } } }] },
      select: { id: true, code: true, agency: true, city: true, user: { select: { name: true, status: true } } }, take: query.limit,
    });
  }
  if (requested.has('lenders') && can('lenders:read')) {
    searches.lenders = prisma.lender.findMany({ where: { name: { contains: query.q, mode: 'insensitive' } }, select: { id: true, name: true, type: true, status: true }, take: query.limit });
  }
  if (requested.has('products') && can('products:read')) {
    searches.products = prisma.product.findMany({ where: { OR: [{ serviceType: { contains: query.q, mode: 'insensitive' } }, { tagline: { contains: query.q, mode: 'insensitive' } }] }, select: { id: true, serviceType: true, active: true, tagline: true }, take: query.limit });
  }

  const entries = await Promise.all(Object.entries(searches).map(async ([type, promise]) => [type, await promise] as const));
  const groups = Object.fromEntries(entries);
  return { query: query.q, groups, counts: Object.fromEntries(entries.map(([type, items]) => [type, items.length])) };
}
