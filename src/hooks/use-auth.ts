"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { PublicUser } from "@/features/auth/auth.service";
import type {
  LoginInput,
  RegisterInput,
} from "@/features/auth/auth.dto";

const ME_KEY = ["auth", "me"] as const;

/** Current authenticated user (null when logged out). */
export function useAuth() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        const res = await api.get<{ user: PublicUser }>("/api/auth/me");
        return res.user;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  return {
    user: data ?? null,
    isLoading,
    isFetching,
    isAuthenticated: Boolean(data),
    refetch,
  };
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      api.post<{ user: PublicUser; csrfToken: string }>(
        "/api/auth/login",
        input,
      ),
    onSuccess: (data) => {
      qc.setQueryData(ME_KEY, data.user);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api.post<{ user: PublicUser }>("/api/auth/register", input),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/auth/logout"),
    onSuccess: () => {
      qc.setQueryData(ME_KEY, null);
      qc.clear();
    },
  });
}
