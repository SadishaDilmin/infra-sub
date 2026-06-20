"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageLoader, Spinner } from "@/components/shared/page-loader";
import { usePlans, useStartCheckout } from "@/hooks/use-billing";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/utils";
import { BILLING_INTERVAL } from "@/config/constants";

export function PricingCards() {
  const { data, isLoading } = usePlans();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const checkout = useStartCheckout();
  const [yearly, setYearly] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  if (isLoading) return <PageLoader />;
  const plans = data?.plans ?? [];

  if (plans.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        No plans are available yet. Please check back soon.
      </p>
    );
  }

  const handleSelect = (planId: string) => {
    if (!isAuthenticated) {
      router.push(`/register?next=/dashboard/billing`);
      return;
    }
    setPendingId(planId);
    checkout.mutate(
      {
        planId,
        interval: yearly ? BILLING_INTERVAL.YEARLY : BILLING_INTERVAL.MONTHLY,
      },
      {
        onError: (err: Error) => {
          toast.error(err.message || "Could not start checkout");
          setPendingId(null);
        },
      },
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-3">
        <Label htmlFor="billing-toggle" className="text-sm">
          Monthly
        </Label>
        <Switch id="billing-toggle" checked={yearly} onCheckedChange={setYearly} />
        <Label htmlFor="billing-toggle" className="text-sm">
          Yearly <span className="text-emerald-500">(save more)</span>
        </Label>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;
          return (
            <Card
              key={plan.id}
              className={
                plan.highlighted
                  ? "relative border-primary shadow-lg ring-1 ring-primary"
                  : "relative"
              }
            >
              {plan.highlighted ? (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most popular
                </Badge>
              ) : null}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
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
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  disabled={checkout.isPending && pendingId === plan.id}
                  onClick={() => handleSelect(plan.id)}
                >
                  {checkout.isPending && pendingId === plan.id ? (
                    <Spinner />
                  ) : isAuthenticated ? (
                    "Subscribe"
                  ) : (
                    "Get started"
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
