import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, ROLES } from "@/config/constants";
import { getSessionUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

/**
 * Admin shell. Authoritative RBAC is enforced on every /api/admin/* route via
 * `withApi({ roles })`; this layout is the UI-level gate. We redirect non-admins
 * to the customer dashboard and unauthenticated visitors to login.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  const store = await cookies();
  const hasRefresh = Boolean(store.get(AUTH_COOKIE.REFRESH));

  if (!session && !hasRefresh) redirect("/login?next=/admin");
  if (session && session.role !== ROLES.SUPER_ADMIN) redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      <Sidebar variant="admin" />
      <div className="flex flex-1 flex-col">
        <Topbar title="Admin" />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
