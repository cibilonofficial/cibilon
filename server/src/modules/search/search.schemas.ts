import { z } from 'zod';

export const globalSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  types: z.string().trim().max(200).optional().transform((value) => value?.split(',').map((item) => item.trim()).filter(Boolean)),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;
