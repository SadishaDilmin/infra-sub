"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageLoader } from "@/components/shared/page-loader";
import { useInvoices } from "@/hooks/use-billing";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useInvoices(page);

  if (isLoading) return <PageLoader />;
  const invoices = data?.invoices ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0 };
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                <TableCell>{formatDate(inv.issueDate)}</TableCell>
                <TableCell>{inv.planName || "—"}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(inv.amount, inv.currency)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(inv.tax, inv.currency)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(inv.total, inv.currency)}
                </TableCell>
                <TableCell className="text-right">
                  <StatusBadge status={inv.status} />
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No invoices yet
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
