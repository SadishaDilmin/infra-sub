import { z } from "zod";

export const createPlanSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  description: z.string().max(500).default(""),
  monthlyPrice: z.number().min(0, "Price cannot be negative"),
  yearlyPrice: z.number().min(0, "Price cannot be negative"),
  currency: z.enum(["LKR", "USD"]).default("LKR"),
  features: z.array(z.string().max(120)).default([]),
  highlighted: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

// All fields optional for PATCH semantics.
export const updatePlanSchema = createPlanSchema.partial();
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
