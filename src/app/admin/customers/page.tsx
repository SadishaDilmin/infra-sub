"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageLoader } from "@/components/shared/page-loader";
import { useAdminCustomers, useSetCustomerStatus } from "@/hooks/use-admin";
import { formatDate } from "@/lib/utils";

export default function AdminCustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const { data, isLoading, isFetching } = useAdminCustomers({
    page,
    search,
    status: status === "ALL" ? undefined : status,
  });
  const setStatusMutation = useSetCustomerStatus();

  const act = (id: string, action: "suspend" | "reactivate") => {
    setStatusMutation.mutate(
      { id, action },
      {
        onSuccess: () =>
          toast.success(action === "suspend" ? "Customer suspended" : "Customer reactivated"),
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  const customers = data?.customers ?? [];
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0 };
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customers</CardTitle>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Input
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="sm:max-w-xs"
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setPage(1);
              setStatus(v);
            }}
          >
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <PageLoader />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">
                      {c.firstName} {c.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.subscriptionStatus} />
                  </TableCell>
                  <TableCell>{formatDate(c.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {c.status === "SUSPENDED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={setStatusMutation.isPending}
                        onClick={() => act(c.id, "reactivate")}
                      >
                        Reactivate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={setStatusMutation.isPending}
                        onClick={() => act(c.id, "suspend")}
                      >
                        Suspend
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No customers found
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.total} customer{pagination.total === 1 ? "" : "s"}
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
