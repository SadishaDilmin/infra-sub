import { withApi } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { analyticsService } from "@/features/analytics/analytics.service";
import { ROLES } from "@/config/constants";

export const runtime = "nodejs";

/** GET /api/admin/metrics — KPIs, revenue trend, plan distribution, recent payments. */
export const GET = withApi(
  async () => {
    const [metrics, recentPayments] = await Promise.all([
      analyticsService.adminMetrics(),
      analyticsService.recentPayments(10),
    ]);
    return ok({ metrics, recentPayments });
  },
  { roles: [ROLES.SUPER_ADMIN] },
);
