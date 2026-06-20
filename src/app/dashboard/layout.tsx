import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE } from "@/config/constants";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/dashboard/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/**
 * Customer dashboard shell. Server-side presence check is one layer of the
 * gate (middleware + per-API RBAC are the others). We allow through if either
 * an access OR refresh cookie exists; the client finalises the session and
 * silently refreshes an expired access token rather than bouncing to login.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const hasSession =
    store.get(AUTH_COOKIE.ACCESS) || store.get(AUTH_COOKIE.REFRESH);
  if (!hasSession) redirect("/login?next=/dashboard");

  // Restore the collapsed/expanded state the user last chose (set by the
  // sidebar provider as a cookie) so there's no layout flash on first paint.
  const defaultOpen = store.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar variant="customer" />
      <SidebarInset>
        <AppHeader title="Dashboard" />
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
