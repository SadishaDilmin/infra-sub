import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  phone: z.string().max(30).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .max(72)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Admin actions on customers.
export const adminUpdateUserStatusSchema = z.object({
  action: z.enum(["suspend", "reactivate"]),
});
export type AdminUpdateUserStatusInput = z.infer<
  typeof adminUpdateUserStatusSchema
>;
