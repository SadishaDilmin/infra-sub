import { z } from "zod";
import { BILLING_INTERVAL } from "@/config/constants";

export const createSubscriptionSchema = z.object({
  planId: z.string().min(1, "planId is required"),
  interval: z.enum([BILLING_INTERVAL.MONTHLY, BILLING_INTERVAL.YEARLY]),
});
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const changePlanSchema = z.object({
  planId: z.string().min(1, "planId is required"),
  interval: z.enum([BILLING_INTERVAL.MONTHLY, BILLING_INTERVAL.YEARLY]),
});
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
