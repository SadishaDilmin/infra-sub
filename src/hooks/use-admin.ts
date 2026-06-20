"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AdminMetrics } from "@/features/analytics/analytics.service";
import type { PublicPlan } from "@/features/plans/plan.service";
import type {
  CreatePlanInput,
  UpdatePlanInput,
} from "@/features/plans/plan.dto";

type RecentPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentDate: string;
  transactionId: string;
  customer: { name: string; email: string } | null;
};

export type AdminCustomer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  subscriptionStatus: string | null;
};

export function useAdminMetrics() {
  return useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: () =>
      api.get<{ metrics: AdminMetrics; recentPayments: RecentPayment[] }>(
        "/api/admin/metrics",
      ),
  });
}

export function useAdminPlans() {
  return useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => api.get<{ plans: PublicPlan[] }>("/api/admin/plans"),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlanInput) =>
      api.post<{ plan: PublicPlan }>("/api/admin/plans", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "plans"] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlanInput }) =>
      api.patch<{ plan: PublicPlan }>(`/api/admin/plans/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "plans"] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/plans/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "plans"] }),
  });
}

export function useAdminCustomers(opts: { page?: number; search?: string; status?: string }) {
  const params = new URLSearchParams();
  params.set("page", String(opts.page ?? 1));
  if (opts.search) params.set("search", opts.search);
  if (opts.status) params.set("status", opts.status);
  return useQuery({
    queryKey: ["admin", "customers", opts],
    queryFn: () =>
      api.get<{
        customers: AdminCustomer[];
        pagination: { page: number; limit: number; total: number };
      }>(`/api/admin/customers?${params.toString()}`),
  });
}

export function useSetCustomerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "suspend" | "reactivate" }) =>
      api.patch(`/api/admin/customers/${id}/status`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "customers"] }),
  });
}
