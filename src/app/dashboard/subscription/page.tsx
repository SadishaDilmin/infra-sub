"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageLoader, Spinner } from "@/components/shared/page-loader";
import { useSubscription, useCancelSubscription } from "@/hooks/use-billing";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function SubscriptionPage() {
  const { data, isLoading } = useSubscription();
  const cancel = useCancelSubscription();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) return <PageLoader />;
  const sub = data?.subscription ?? null;

  if (!sub) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted-foreground">No active subscription.</p>
          <Button asChild>
            <Link href="/dashboard/billing">Browse plans</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canManage = sub.status === "ACTIVE" || sub.status === "PAST_DUE";

  const handleCancel = () => {
    cancel.mutate(undefined, {
      onSuccess: () => {
        toast.success("Subscription cancelled");
        setConfirmOpen(false);
      },
      onError: (err: Error) => toast.error(err.message || "Cancellation failed"),
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{sub.plan?.name ?? "Subscription"}</CardTitle>
              <CardDescription>
                {formatCurrency(sub.amount, sub.currency)} /{" "}
                {sub.interval.toLowerCase()}
              </CardDescription>
            </div>
            <StatusBadge status={sub.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Started</p>
              <p className="font-medium">{formatDate(sub.startedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {sub.status === "CANCELLED" ? "Access until" : "Next billing"}
              </p>
              <p className="font-medium">
                {formatDate(sub.endedAt ?? sub.nextBillingDate)}
              </p>
            </div>
          </div>

          {sub.plan?.features?.length ? (
            <div>
              <p className="mb-2 text-sm font-medium">Includes</p>
              <ul className="space-y-1 text-sm">
                {sub.plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canManage ? (
            <div className="flex flex-wrap gap-3 border-t pt-4">
              <Button asChild>
                <Link href="/dashboard/billing">Change / upgrade plan</Link>
              </Button>
              <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                Cancel subscription
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel subscription?</DialogTitle>
            <DialogDescription>
              Your subscription will be cancelled and recurring billing stopped.
              You keep access until the end of the current period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancel.isPending}
            >
              {cancel.isPending ? <Spinner /> : "Yes, cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
