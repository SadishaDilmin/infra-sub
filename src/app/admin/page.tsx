"use client";

import {
  Users,
  UserCheck,
  Wallet,
  TrendingUp,
  Layers,
  XCircle,
  AlertTriangle,
} from "lucide-react";
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
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageLoader } from "@/components/shared/page-loader";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { useAdminMetrics } from "@/hooks/use-admin";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function AdminAnalyticsPage() {
  const { data, isLoading } = useAdminMetrics();
  if (isLoading || !data) return <PageLoader />;

  const m = data.metrics;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total customers" value={m.totalCustomers} icon={Users} />
        <StatCard label="Active customers" value={m.activeCustomers} icon={UserCheck} />
        <StatCard
          label="Monthly revenue"
          value={formatCurrency(m.monthlyRevenue, m.currency)}
          icon={Wallet}
        />
        <StatCard
          label="Annual revenue"
          value={formatCurrency(m.annualRevenue, m.currency)}
          icon={TrendingUp}
        />
        <StatCard label="Active subscriptions" value={m.activeSubscriptions} icon={Layers} />
        <StatCard label="Cancelled" value={m.cancelledSubscriptions} icon={XCircle} />
        <StatCard label="Failed payments" value={m.failedPayments} icon={AlertTriangle} />
        <StatCard label="Suspended" value={m.suspendedCustomers} icon={Users} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue (last 12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={m.revenueTrend} currency={m.currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {m.planDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active subscriptions.</p>
            ) : (
              m.planDistribution.map((p) => (
                <div key={p.plan} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{p.plan}</span>
                  <span className="text-muted-foreground">{p.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent payments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.customer?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.customer?.email}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(p.paymentDate)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(p.amount, p.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge status={p.status} />
                  </TableCell>
                </TableRow>
              ))}
              {data.recentPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No payments yet
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
