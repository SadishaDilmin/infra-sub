import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getPagination } from "@/lib/api/request";
import { userService } from "@/features/users/user.service";
import { ROLES } from "@/config/constants";

export const runtime = "nodejs";

/** GET /api/admin/customers — paginated customer list with search/status filter. */
export const GET = withApi(
  async ({ req }) => {
    const { page, limit, skip } = getPagination(req);
    const url = new URL(req.url);
    const { items, total } = await userService.listCustomers({
      skip,
      limit,
      search: url.searchParams.get("search") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    return ok({ customers: items, pagination: { page, limit, total } });
  },
  { roles: [ROLES.SUPER_ADMIN] },
);
