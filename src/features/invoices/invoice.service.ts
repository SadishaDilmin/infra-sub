import { Invoice, type InvoiceDoc } from "@/models/invoice.model";
import { nextSequence } from "@/models/counter.model";
import type { PaymentDoc } from "@/models/payment.model";
import { DEFAULT_TAX_RATE, INVOICE_STATUS } from "@/config/constants";
import { NotFound } from "@/lib/errors";

export type PublicInvoice = {
  id: string;
  invoiceNumber: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  planName: string;
  issueDate: Date;
  dueDate: Date;
  status: string;
};

function serializeInvoice(inv: InvoiceDoc): PublicInvoice {
  return {
    id: String(inv._id),
    invoiceNumber: inv.invoiceNumber,
    amount: inv.amount,
    tax: inv.tax,
    total: inv.total,
    currency: inv.currency,
    planName: inv.planName,
    issueDate: inv.issueDate as Date,
    dueDate: inv.dueDate as Date,
    status: inv.status,
  };
}

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`invoice-${year}`);
  return `INV-${year}-${String(seq).padStart(6, "0")}`;
}

export const invoiceService = {
  /**
   * Create an invoice for a successful payment. Idempotent: the unique index on
   * `paymentId` means a duplicate webhook cannot create a second invoice.
   */
  async createForPayment(
    payment: PaymentDoc,
    opts: { planName: string },
  ): Promise<PublicInvoice> {
    const existing = await Invoice.findOne({ paymentId: payment._id });
    if (existing) return serializeInvoice(existing);

    const amount = payment.amount;
    const tax = Math.round(amount * DEFAULT_TAX_RATE * 100) / 100;
    const total = Math.round((amount + tax) * 100) / 100;
    const issueDate = payment.paymentDate as Date;

    try {
      const invoice = await Invoice.create({
        invoiceNumber: await generateInvoiceNumber(),
        userId: payment.userId,
        paymentId: payment._id,
        subscriptionId: payment.subscriptionId ?? null,
        planName: opts.planName,
        amount,
        tax,
        total,
        currency: payment.currency,
        issueDate,
        dueDate: issueDate, // paid immediately
        status: INVOICE_STATUS.PAID,
      });
      return serializeInvoice(invoice);
    } catch (err: unknown) {
      // Duplicate key (race with a concurrent webhook) → return the winner.
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        const winner = await Invoice.findOne({ paymentId: payment._id });
        if (winner) return serializeInvoice(winner);
      }
      throw err;
    }
  },

  async listForUser(userId: string, opts: { skip: number; limit: number }) {
    const [items, total] = await Promise.all([
      Invoice.find({ userId })
        .sort({ issueDate: -1 })
        .skip(opts.skip)
        .limit(opts.limit)
        .lean<InvoiceDoc[]>(),
      Invoice.countDocuments({ userId }),
    ]);
    return { items: items.map(serializeInvoice), total };
  },

  async getForUser(invoiceId: string, userId: string) {
    const inv = await Invoice.findOne({ _id: invoiceId, userId });
    if (!inv) throw NotFound("Invoice not found");
    return serializeInvoice(inv);
  },
};
