"use client";

import Link from "next/link";
import { CreditCard, Layers, CalendarClock, Wallet } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageLoader } from "@/components/shared/page-loader";
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
import { useDashboard } from "@/hooks/use-billing";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function DashboardOverviewPage() {
  const { data, isLoading } = useDashboard();
  if (isLoading) return <PageLoader />;

  const sub = data?.subscription ?? null;
  const totals = data?.totals ?? { totalPaid: 0, count: 0 };
  const currency = sub?.currency ?? "LKR";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Current plan"
          value={sub?.plan?.name ?? "No plan"}
          icon={Layers}
          hint={sub ? `${sub.interval.toLowerCase()} billing` : "Choose a plan to begin"}
        />
        <StatCard
          label="Status"
          value={<StatusBadge status={sub?.status} />}
          icon={CreditCard}
        />
        <StatCard
          label="Next billing"
          value={sub?.nextBillingDate ? formatDate(sub.nextBillingDate) : "—"}
          icon={CalendarClock}
        />
        <StatCard
          label="Total paid"
          value={formatCurrency(totals.totalPaid, currency)}
          icon={Wallet}
          hint={`${totals.count} successful payment${totals.count === 1 ? "" : "s"}`}
        />
      </div>

      {!sub ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-muted-foreground">
              You don&apos;t have an active subscription yet.
            </p>
            <Button asChild>
              <Link href="/dashboard/billing">Choose a plan</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent invoices</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/invoices">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.recentInvoices ?? []).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell>{formatDate(inv.issueDate)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(inv.total, inv.currency)}
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.recentInvoices ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No invoices yet
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payment history</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/billing">Manage</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.recentPayments ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paymentDate)}</TableCell>
                    <TableCell>{formatCurrency(p.amount, p.currency)}</TableCell>
                    <TableCell className="text-right">
                      <StatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.recentPayments ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No payments yet
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
