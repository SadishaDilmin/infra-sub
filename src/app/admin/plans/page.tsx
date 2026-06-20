"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { PageLoader, Spinner } from "@/components/shared/page-loader";
import {
  useAdminPlans,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
} from "@/hooks/use-admin";
import type { PublicPlan } from "@/features/plans/plan.service";
import { formatCurrency } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().max(500).optional(),
  monthlyPrice: z.coerce.number().min(0),
  yearlyPrice: z.coerce.number().min(0),
  currency: z.enum(["LKR", "USD"]),
  features: z.string().optional(),
  highlighted: z.boolean(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(),
});
type FormValues = z.input<typeof formSchema>;

function PlanDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: PublicPlan | null;
}) {
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: {
      name: editing?.name ?? "",
      description: editing?.description ?? "",
      monthlyPrice: editing?.monthlyPrice ?? 0,
      yearlyPrice: editing?.yearlyPrice ?? 0,
      currency: (editing?.currency as "LKR" | "USD") ?? "LKR",
      features: editing?.features?.join("\n") ?? "",
      highlighted: editing?.highlighted ?? false,
      active: editing?.active ?? true,
      sortOrder: editing?.sortOrder ?? 0,
    },
  });

  const onSubmit = (values: FormValues) => {
    const payload = {
      name: values.name,
      description: values.description ?? "",
      monthlyPrice: Number(values.monthlyPrice),
      yearlyPrice: Number(values.yearlyPrice),
      currency: values.currency,
      features: (values.features ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      highlighted: values.highlighted,
      active: values.active,
      sortOrder: Number(values.sortOrder),
    };

    const onDone = (msg: string) => {
      toast.success(msg);
      onOpenChange(false);
    };
    const onError = (err: Error) => toast.error(err.message);

    if (editing) {
      updatePlan.mutate(
        { id: editing.id, input: payload },
        { onSuccess: () => onDone("Plan updated"), onError },
      );
    } else {
      createPlan.mutate(payload, {
        onSuccess: () => onDone("Plan created"),
        onError,
      });
    }
  };

  const busy = createPlan.isPending || updatePlan.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit plan" : "Create plan"}</DialogTitle>
          <DialogDescription>
            Plans are stored in MongoDB and shown on the pricing page.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Business" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="For growing teams" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="monthlyPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="yearlyPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Yearly price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="features"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Features</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder={"One feature per line\n99.9% uptime SLA\nPriority support"}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>One feature per line.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort order</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-end gap-6 pb-2">
                <FormField
                  control={form.control}
                  name="highlighted"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Popular</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Active</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy ? <Spinner /> : editing ? "Save plan" : "Create plan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPlansPage() {
  const { data, isLoading } = useAdminPlans();
  const deletePlan = useDeletePlan();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PublicPlan | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (plan: PublicPlan) => {
    setEditing(plan);
    setDialogOpen(true);
  };
  const onDelete = (plan: PublicPlan) => {
    if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    deletePlan.mutate(plan.id, {
      onSuccess: () => toast.success("Plan deleted"),
      onError: (err: Error) => toast.error(err.message),
    });
  };

  if (isLoading) return <PageLoader />;
  const plans = data?.plans ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Plans</CardTitle>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New plan
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Monthly</TableHead>
              <TableHead className="text-right">Yearly</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    {plan.name}
                    {plan.highlighted ? (
                      <Badge variant="secondary">Popular</Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{plan.slug}</div>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(plan.monthlyPrice, plan.currency)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(plan.yearlyPrice, plan.currency)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={plan.active ? "ACTIVE" : "VOID"} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(plan)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(plan)}
                      disabled={deletePlan.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No plans yet — create your first one.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>

      <PlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />
    </Card>
  );
}
