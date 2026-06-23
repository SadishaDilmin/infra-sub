"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { submitPayhereCheckout } from "@/lib/payhere/checkout-client";
import { redirectToPolarCheckout } from "@/lib/polar/checkout-client";
import type { PublicPlan } from "@/features/plans/plan.service";
import type { PublicInvoice } from "@/features/invoices/invoice.service";
import type { PublicPayment } from "@/features/payments/payment.service";
import type {
  CreateSubscriptionInput,
} from "@/features/subscriptions/subscription.dto";

type CheckoutResponse = {
  subscriptionId: string;
  orderId: string;
  provider: "payhere" | "polar";
  actionUrl?: string;
  fields?: Record<string, string>;
  redirectUrl?: string;
};

/** Send the browser to the right provider's checkout. */
function goToCheckout(checkout: CheckoutResponse) {
  if (checkout.provider === "polar" && checkout.redirectUrl) {
    redirectToPolarCheckout(checkout.redirectUrl);
  } else if (checkout.actionUrl && checkout.fields) {
    submitPayhereCheckout(checkout.actionUrl, checkout.fields);
  }
}

type DashboardData = {
  subscription: CurrentSubscription | null;
  totals: { totalPaid: number; count: number };
  recentInvoices: PublicInvoice[];
  recentPayments: PublicPayment[];
};

export type CurrentSubscription = {
  id: string;
  status: string;
  interval: string;
  amount: number;
  currency: string;
  startedAt: string | null;
  nextBillingDate: string | null;
  cancelledAt: string | null;
  endedAt: string | null;
  plan: { id: string; name: string; slug: string; features: string[] } | null;
};

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<{ plans: PublicPlan[] }>("/api/plans"),
    staleTime: 5 * 60_000,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/api/dashboard"),
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: () =>
      api.get<{ subscription: CurrentSubscription | null }>(
        "/api/subscriptions",
      ),
  });
}

export function useInvoices(page = 1) {
  return useQuery({
    queryKey: ["invoices", page],
    queryFn: () =>
      api.get<{
        invoices: PublicInvoice[];
        pagination: { page: number; limit: number; total: number };
      }>(`/api/invoices?page=${page}`),
  });
}

export function usePayments(page = 1) {
  return useQuery({
    queryKey: ["payments", page],
    queryFn: () =>
      api.get<{
        payments: PublicPayment[];
        pagination: { page: number; limit: number; total: number };
      }>(`/api/payments?page=${page}`),
  });
}

/** Start a checkout and redirect the browser to PayHere. */
export function useStartCheckout() {
  return useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => {
      const { checkout } = await api.post<{ checkout: CheckoutResponse }>(
        "/api/subscriptions",
        input,
      );
      goToCheckout(checkout);
      return checkout;
    },
  });
}

export function useChangePlan() {
  return useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => {
      const { checkout } = await api.post<{ checkout: CheckoutResponse }>(
        "/api/subscriptions/change",
        input,
      );
      goToCheckout(checkout);
      return checkout;
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/subscriptions/cancel"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
