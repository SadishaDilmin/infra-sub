"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  Receipt,
  Layers,
  Settings,
  Users,
  BarChart3,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

const customerNav: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/subscription", label: "Subscription", icon: Layers },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Analytics", icon: BarChart3 },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/plans", label: "Plans", icon: Boxes },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
];

export function Sidebar({ variant }: { variant: "customer" | "admin" }) {
  const pathname = usePathname();
  const items = variant === "admin" ? adminNav : customerNav;

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card/40 md:flex md:flex-col">
      <div className="flex h-16 items-center border-b px-6">
        <Logo href={variant === "admin" ? "/admin" : "/dashboard"} />
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              item.href !== "/admin" &&
              pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {variant === "admin" ? (
        <div className="border-t p-4">
          <Link
            href="/dashboard"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Customer view
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
