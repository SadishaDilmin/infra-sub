import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { invoiceService } from "@/features/invoices/invoice.service";

export const runtime = "nodejs";

type Params = { id: string };

/** GET /api/invoices/:id — a single invoice owned by the caller. */
export const GET = withApi<Params>(
  async ({ params, user }) => {
    const invoice = await invoiceService.getForUser(params.id, user!.id);
    return ok({ invoice });
  },
  { auth: true },
);
