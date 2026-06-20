import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getPagination } from "@/lib/api/request";
import { Payment } from "@/models/payment.model";
import { ROLES } from "@/config/constants";

export const runtime = "nodejs";

/** GET /api/admin/payments — global payment history (admin). */
export const GET = withApi(
  async ({ req }) => {
    const { page, limit, skip } = getPagination(req);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const filter = status ? { status } : {};

    const [items, total] = await Promise.all([
      Payment.find(filter)
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "firstName lastName email")
        .lean(),
      Payment.countDocuments(filter),
    ]);

    const payments = items.map((p) => {
      const u = p.userId as unknown as {
        firstName?: string;
        lastName?: string;
        email?: string;
      } | null;
      return {
        id: String(p._id),
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        transactionId: p.transactionId,
        paymentDate: p.paymentDate,
        customer: u
          ? { name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(), email: u.email ?? "" }
          : null,
      };
    });

    return ok({ payments, pagination: { page, limit, total } });
  },
  { roles: [ROLES.SUPER_ADMIN] },
);
