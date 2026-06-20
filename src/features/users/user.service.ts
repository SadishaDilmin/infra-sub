import { User, type UserDoc } from "@/models/user.model";
import { RefreshToken } from "@/models/refresh-token.model";
import { Subscription } from "@/models/subscription.model";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { audit, AUDIT_ACTIONS } from "@/lib/audit/audit";
import { BadRequest, NotFound } from "@/lib/errors";
import { ROLES, USER_STATUS } from "@/config/constants";
import { serializeUser, type PublicUser } from "@/features/auth/auth.service";
import type {
  ChangePasswordInput,
  UpdateProfileInput,
} from "./user.dto";

export const userService = {
  async getProfile(userId: string): Promise<PublicUser> {
    const user = await User.findById(userId);
    if (!user) throw NotFound("User not found");
    return serializeUser(user);
  },

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
    ctx: { ip?: string },
  ) {
    const user = await User.findById(userId);
    if (!user) throw NotFound("User not found");
    if (input.firstName !== undefined) user.firstName = input.firstName;
    if (input.lastName !== undefined) user.lastName = input.lastName;
    if (input.phone !== undefined) user.phone = input.phone;
    await user.save();
    await audit({
      action: AUDIT_ACTIONS.PROFILE_UPDATED,
      actorId: userId,
      actorEmail: user.email,
      ip: ctx.ip,
    });
    return serializeUser(user);
  },

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await User.findById(userId).select("+password");
    if (!user) throw NotFound("User not found");
    const valid = await verifyPassword(input.currentPassword, user.password);
    if (!valid) throw BadRequest("Current password is incorrect");
    user.password = await hashPassword(input.newPassword);
    user.tokenVersion += 1;
    await user.save();
    // Revoke other sessions on password change.
    await RefreshToken.updateMany(
      { userId: user._id, revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } },
    );
    return { ok: true };
  },

  // ---- Admin operations ----

  async listCustomers(opts: {
    skip: number;
    limit: number;
    search?: string;
    status?: string;
  }) {
    const filter: Record<string, unknown> = { role: ROLES.CUSTOMER };
    if (opts.status) filter.status = opts.status;
    if (opts.search) {
      filter.$or = [
        { email: { $regex: opts.search, $options: "i" } },
        { firstName: { $regex: opts.search, $options: "i" } },
        { lastName: { $regex: opts.search, $options: "i" } },
      ];
    }
    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(opts.skip)
        .limit(opts.limit)
        .lean<UserDoc[]>(),
      User.countDocuments(filter),
    ]);

    // Attach each customer's current subscription status (single aggregate-free pass).
    const ids = items.map((u) => u._id);
    const subs = await Subscription.find({
      userId: { $in: ids },
      status: {
        $in: [
          USER_STATUS.ACTIVE,
          "PENDING",
          "PAST_DUE",
        ],
      },
    })
      .select("userId status planId")
      .lean();
    const subByUser = new Map(subs.map((s) => [String(s.userId), s.status]));

    return {
      items: items.map((u) => ({
        ...serializeUser(u as UserDoc),
        subscriptionStatus: subByUser.get(String(u._id)) ?? null,
      })),
      total,
    };
  },

  async setStatus(
    customerId: string,
    action: "suspend" | "reactivate",
    actor: { id: string; email: string; ip?: string },
  ) {
    const user = await User.findById(customerId);
    if (!user) throw NotFound("Customer not found");
    if (user.role === ROLES.SUPER_ADMIN) {
      throw BadRequest("Cannot change status of an admin account");
    }

    if (action === "suspend") {
      user.status = USER_STATUS.SUSPENDED;
      await user.save();
      // Force logout everywhere.
      await RefreshToken.updateMany(
        { userId: user._id, revoked: false },
        { $set: { revoked: true, revokedAt: new Date() } },
      );
      await audit({
        action: AUDIT_ACTIONS.CUSTOMER_SUSPENDED,
        actorId: actor.id,
        actorEmail: actor.email,
        targetType: "User",
        targetId: customerId,
        ip: actor.ip,
      });
    } else {
      user.status = user.emailVerifiedAt
        ? USER_STATUS.ACTIVE
        : USER_STATUS.PENDING;
      await user.save();
      await audit({
        action: AUDIT_ACTIONS.CUSTOMER_REACTIVATED,
        actorId: actor.id,
        actorEmail: actor.email,
        targetType: "User",
        targetId: customerId,
        ip: actor.ip,
      });
    }
    return serializeUser(user);
  },
};
