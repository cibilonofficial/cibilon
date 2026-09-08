import { z } from 'zod';

const fields = {
  categoryId: z.string().trim().regex(/^[a-z0-9-]+$/).max(80),
  categoryName: z.string().trim().min(2).max(120),
  providerName: z.string().trim().min(2).max(240),
  productName: z.string().trim().min(1).max(500),
  payoutText: z.string().trim().min(1).max(120),
  percentageRate: z.coerce.number().min(0).max(100).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  effectiveMonth: z.string().trim().min(2).max(40).optional(),
};

export const createRateCardEntrySchema = z.object(fields);
export const updateRateCardEntrySchema = z.object({
  categoryId: fields.categoryId.optional(), categoryName: fields.categoryName.optional(),
  providerName: fields.providerName.optional(), productName: fields.productName.optional(),
  payoutText: fields.payoutText.optional(), percentageRate: fields.percentageRate,
  notes: fields.notes, effectiveMonth: fields.effectiveMonth,
}).refine((input) => Object.keys(input).length > 0, 'At least one field must be provided');
export const rateCardIdSchema = z.object({ id: z.string().uuid() });

export type CreateRateCardEntryInput = z.infer<typeof createRateCardEntrySchema>;
export type UpdateRateCardEntryInput = z.infer<typeof updateRateCardEntrySchema>;
