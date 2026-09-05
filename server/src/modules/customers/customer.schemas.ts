import { z } from 'zod';

const optionalCustomerFields = {
  fullName: z.string().trim().min(2).max(160).optional(),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
    .optional(),
  email: z.string().trim().toLowerCase().email().max(320).optional(),
  dateOfBirth: z.iso.date().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must match ABCDE1234F')
    .optional(),
  aadhaar: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .pipe(z.string().length(12, 'Aadhaar must contain 12 digits'))
    .optional(),
  addressLine: z.string().trim().min(3).max(500).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(100).optional(),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/).optional(),
};

export const customerDraftSchema = z.object(optionalCustomerFields).strict();

export const createCustomerSchema = z
  .object({
    advisorId: z.string().uuid().optional(),
    ...optionalCustomerFields,
    fullName: optionalCustomerFields.fullName.unwrap(),
    mobile: optionalCustomerFields.mobile.unwrap(),
    email: optionalCustomerFields.email.unwrap(),
    dateOfBirth: optionalCustomerFields.dateOfBirth.unwrap(),
    gender: optionalCustomerFields.gender.unwrap(),
    pan: optionalCustomerFields.pan.unwrap(),
    aadhaar: optionalCustomerFields.aadhaar.unwrap(),
    addressLine: optionalCustomerFields.addressLine.unwrap(),
    city: optionalCustomerFields.city.unwrap(),
    state: optionalCustomerFields.state.unwrap(),
    pincode: optionalCustomerFields.pincode.unwrap(),
  })
  .strict();

export const updateCustomerSchema = customerDraftSchema.refine(
  (input) => Object.keys(input).length > 0,
  'At least one field must be provided',
);

export const customerIdParamsSchema = z.object({ id: z.string().uuid() });

export const customerListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  advisorId: z.string().uuid().optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  archived: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'fullName', 'city']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CustomerDraftInput = z.infer<typeof customerDraftSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
