"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
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
import { formatCurrency, formatDate } from "@/lib/utils";

type AdminPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  transactionId: string;
  paymentDate: string;
  customer: { name: string; email: string } | null;
};

export default function AdminPaymentsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "payments", page],
    queryFn: () =>
      api.get<{
        payments: AdminPayment[];
        pagination: { page: number; limit: number; total: number };
      }>(`/api/admin/payments?page=${page}`),
  });

  if (isLoading) return <PageLoader />;
  const payments = data?.payments ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0 };
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <Card>
      <CardHeader>
        <CardTitle>All payments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Transaction</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.customer?.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.customer?.email}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{p.transactionId}</TableCell>
                <TableCell>{formatDate(p.paymentDate)}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(p.amount, p.currency)}
                </TableCell>
                <TableCell className="text-right">
                  <StatusBadge status={p.status} />
                </TableCell>
              </TableRow>
            ))}
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No payments yet
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.total} payment{pagination.total === 1 ? "" : "s"}
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
