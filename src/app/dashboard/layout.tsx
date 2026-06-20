import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE } from "@/config/constants";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

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

  return (
    <div className="flex min-h-screen">
      <Sidebar variant="customer" />
      <div className="flex flex-1 flex-col">
        <Topbar title="Dashboard" />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
