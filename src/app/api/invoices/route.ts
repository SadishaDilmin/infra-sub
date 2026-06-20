import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getPagination } from "@/lib/api/request";
import { invoiceService } from "@/features/invoices/invoice.service";

export const runtime = "nodejs";

/** GET /api/invoices — paginated invoices for the caller. */
export const GET = withApi(
  async ({ req, user }) => {
    const { page, limit, skip } = getPagination(req);
    const { items, total } = await invoiceService.listForUser(user!.id, {
      skip,
      limit,
    });
    return ok({ invoices: items, pagination: { page, limit, total } });
  },
  { auth: true },
);
