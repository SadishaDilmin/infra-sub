import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { subscriptionService } from "@/features/subscriptions/subscription.service";
import { paymentService } from "@/features/payments/payment.service";
import { invoiceService } from "@/features/invoices/invoice.service";

export const runtime = "nodejs";

/** GET /api/dashboard — customer dashboard summary (subscription, totals, recent). */
export const GET = withApi(
  async ({ user }) => {
    const [subscription, totals, recentInvoices, recentPayments] =
      await Promise.all([
        subscriptionService.getCurrentForUser(user!.id),
        paymentService.totalsForUser(user!.id),
        invoiceService.listForUser(user!.id, { skip: 0, limit: 5 }),
        paymentService.listForUser(user!.id, { skip: 0, limit: 5 }),
      ]);

    return ok({
      subscription,
      totals,
      recentInvoices: recentInvoices.items,
      recentPayments: recentPayments.items,
    });
  },
  { auth: true },
);
