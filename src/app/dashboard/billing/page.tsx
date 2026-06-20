"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageLoader, Spinner } from "@/components/shared/page-loader";
import {
  usePlans,
  useSubscription,
  useStartCheckout,
  useChangePlan,
} from "@/hooks/use-billing";
import { formatCurrency } from "@/lib/utils";
import { BILLING_INTERVAL } from "@/config/constants";

function BillingPlans() {
  const params = useSearchParams();
  const { data: plansData, isLoading } = usePlans();
  const { data: subData } = useSubscription();
  const start = useStartCheckout();
  const change = useChangePlan();
  const [yearly, setYearly] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Surface the PayHere return status (set on PAYHERE_RETURN_URL / cancel URL).
  useEffect(() => {
    const status = params.get("status");
    if (status === "success") {
      toast.success("Payment received — your subscription is being activated.");
    } else if (status === "cancelled") {
      toast.error("Checkout cancelled.");
    }
  }, [params]);

  if (isLoading) return <PageLoader />;
  const plans = plansData?.plans ?? [];
  const sub = subData?.subscription ?? null;
  const hasActive = sub?.status === "ACTIVE" || sub?.status === "PAST_DUE";

  const select = (planId: string) => {
    setPendingId(planId);
    const interval = yearly ? BILLING_INTERVAL.YEARLY : BILLING_INTERVAL.MONTHLY;
    const mutation = hasActive ? change : start;
    mutation.mutate(
      { planId, interval },
      {
        onError: (err: Error) => {
          toast.error(err.message || "Could not start checkout");
          setPendingId(null);
        },
      },
    );
  };

  const busy = start.isPending || change.isPending;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-3">
        <Label className="text-sm">Monthly</Label>
        <Switch checked={yearly} onCheckedChange={setYearly} />
        <Label className="text-sm">Yearly</Label>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
          const isCurrent = sub?.plan?.id === plan.id;
          return (
            <Card
              key={plan.id}
              className={plan.highlighted ? "border-primary ring-1 ring-primary" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent ? <Badge variant="success">Current</Badge> : null}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-bold">
                    {formatCurrency(price, plan.currency)}
                  </span>
                  <span className="text-muted-foreground">
                    /{yearly ? "year" : "month"}
                  </span>
                </div>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  disabled={busy || isCurrent}
                  onClick={() => select(plan.id)}
                >
                  {busy && pendingId === plan.id ? (
                    <Spinner />
                  ) : isCurrent ? (
                    "Current plan"
                  ) : hasActive ? (
                    "Switch to this plan"
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {hasActive ? (
        <p className="text-center text-sm text-muted-foreground">
          Switching plans cancels your current recurring subscription and starts
          a new checkout for the selected plan.
        </p>
      ) : null}
    </div>
  );
}

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing &amp; plans</h2>
        <p className="text-muted-foreground">
          Choose or change your subscription. Payments are processed securely by
          PayHere.
        </p>
      </div>
      <Suspense fallback={<PageLoader />}>
        <BillingPlans />
      </Suspense>
    </div>
  );
}
