import { z } from 'zod';

export const strongPassword = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol');

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(320),
  password: z.string().min(1).max(128),
  remember: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  newPassword: strongPassword,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: strongPassword,
});

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().toLowerCase().email().max(320),
    mobile: z
      .string()
      .trim()
      .min(10)
      .max(20)
      .regex(/^\+?[0-9\s()-]+$/, 'Mobile number contains invalid characters')
      .optional(),
    password: strongPassword,
    roleSlugs: z.array(z.enum(['admin', 'advisor', 'staff'])).min(1).max(3),
    code: z.string().trim().min(2).max(40).optional(),
    agency: z.string().trim().max(160).optional(),
    department: z.string().trim().max(100).optional(),
  })
  .superRefine((input, context) => {
    const identityRoles = input.roleSlugs.filter((role) => role === 'advisor' || role === 'staff');
    if (identityRoles.length > 1) {
      context.addIssue({
        code: 'custom',
        path: ['roleSlugs'],
        message: 'A user cannot be both an advisor and a staff member',
      });
    }
    if (identityRoles.length === 1 && !input.code) {
      context.addIssue({
        code: 'custom',
        path: ['code'],
        message: 'Code is required for advisor and staff users',
      });
    }
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
