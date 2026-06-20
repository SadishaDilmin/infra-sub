import { Badge, type BadgeProps } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

/** Map a domain status string to a sensible badge colour. */
const VARIANT: Record<string, BadgeProps["variant"]> = {
  ACTIVE: "success",
  SUCCESS: "success",
  PAID: "success",
  PENDING: "warning",
  PAST_DUE: "warning",
  UNPAID: "warning",
  SUSPENDED: "destructive",
  FAILED: "destructive",
  CANCELLED: "secondary",
  EXPIRED: "secondary",
  CHARGEBACK: "destructive",
  REFUNDED: "secondary",
  VOID: "secondary",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge variant="secondary">None</Badge>;
  return (
    <Badge variant={VARIANT[status] ?? "secondary"}>{titleCase(status)}</Badge>
  );
}
