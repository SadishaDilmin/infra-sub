import type { HydratedDocument } from "mongoose";
import { Plan, type PlanDoc } from "@/models/plan.model";
import { Subscription } from "@/models/subscription.model";
import { audit, AUDIT_ACTIONS } from "@/lib/audit/audit";
import { BadRequest, Conflict, NotFound } from "@/lib/errors";
import { SUBSCRIPTION_STATUS } from "@/config/constants";
import type { CreatePlanInput, UpdatePlanInput } from "./plan.dto";

export type PublicPlan = {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  features: string[];
  highlighted: boolean;
  sortOrder: number;
  active: boolean;
};

export function serializePlan(plan: PlanDoc): PublicPlan {
  return {
    id: String(plan._id),
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    currency: plan.currency,
    features: plan.features,
    highlighted: plan.highlighted,
    sortOrder: plan.sortOrder,
    active: plan.active,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const planService = {
  /** Public list — active plans only, sorted for the pricing page. */
  async listPublic(): Promise<PublicPlan[]> {
    const plans = await Plan.find({ active: true })
      .sort({ sortOrder: 1, monthlyPrice: 1 })
      .lean<PlanDoc[]>();
    return plans.map(serializePlan);
  },

  /** Admin list — all plans regardless of active state. */
  async listAll(): Promise<PublicPlan[]> {
    const plans = await Plan.find()
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean<PlanDoc[]>();
    return plans.map(serializePlan);
  },

  async getById(id: string): Promise<HydratedDocument<PlanDoc>> {
    const plan = await Plan.findById(id);
    if (!plan) throw NotFound("Plan not found");
    return plan;
  },

  async create(input: CreatePlanInput, actor: { id: string; email: string }) {
    let slug = slugify(input.name);
    if (!slug) throw BadRequest("Plan name must contain alphanumeric chars");
    if (await Plan.exists({ slug })) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const plan = await Plan.create({ ...input, slug });
    await audit({
      action: AUDIT_ACTIONS.PLAN_CREATED,
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "Plan",
      targetId: String(plan._id),
      metadata: { name: plan.name },
    });
    return serializePlan(plan);
  },

  async update(
    id: string,
    input: UpdatePlanInput,
    actor: { id: string; email: string },
  ) {
    const plan = await this.getById(id);
    Object.assign(plan, input);
    if (input.name) {
      const newSlug = slugify(input.name);
      if (
        newSlug &&
        newSlug !== plan.slug &&
        !(await Plan.exists({ slug: newSlug }))
      ) {
        plan.slug = newSlug;
      }
    }
    await plan.save();
    await audit({
      action: AUDIT_ACTIONS.PLAN_UPDATED,
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "Plan",
      targetId: id,
      metadata: { changes: Object.keys(input) },
    });
    return serializePlan(plan);
  },

  /**
   * Delete a plan. We refuse to hard-delete a plan that has active
   * subscriptions (would orphan billing). Instead the admin should deactivate
   * it; we soft-deactivate automatically in that case.
   */
  async remove(id: string, actor: { id: string; email: string }) {
    const inUse = await Subscription.exists({
      planId: id,
      status: {
        $in: [
          SUBSCRIPTION_STATUS.ACTIVE,
          SUBSCRIPTION_STATUS.PENDING,
          SUBSCRIPTION_STATUS.PAST_DUE,
        ],
      },
    });
    if (inUse) {
      throw Conflict(
        "Plan has active subscriptions. Deactivate it instead of deleting.",
      );
    }
    const plan = await Plan.findByIdAndDelete(id);
    if (!plan) throw NotFound("Plan not found");
    await audit({
      action: AUDIT_ACTIONS.PLAN_DELETED,
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "Plan",
      targetId: id,
      metadata: { name: plan.name },
    });
    return { ok: true };
  },
};
