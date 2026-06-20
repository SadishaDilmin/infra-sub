import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getPagination } from "@/lib/api/request";
import { paymentService } from "@/features/payments/payment.service";

export const runtime = "nodejs";

/** GET /api/payments — paginated payment history for the caller. */
export const GET = withApi(
  async ({ req, user }) => {
    const { page, limit, skip } = getPagination(req);
    const { items, total } = await paymentService.listForUser(user!.id, {
      skip,
      limit,
    });
    return ok({ payments: items, pagination: { page, limit, total } });
  },
  { auth: true },
);
