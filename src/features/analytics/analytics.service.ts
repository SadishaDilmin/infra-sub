import { startOfMonth, startOfYear, subMonths, format } from "date-fns";
import { User } from "@/models/user.model";
import { Subscription } from "@/models/subscription.model";
import { Payment } from "@/models/payment.model";
import {
  PAYMENT_STATUS,
  ROLES,
  SUBSCRIPTION_STATUS,
  USER_STATUS,
} from "@/config/constants";

export type AdminMetrics = {
  totalCustomers: number;
  activeCustomers: number;
  suspendedCustomers: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  monthlyRevenue: number;
  annualRevenue: number;
  failedPayments: number;
  currency: string;
  revenueTrend: { month: string; revenue: number }[];
  planDistribution: { plan: string; count: number }[];
};

export const analyticsService = {
  async adminMetrics(): Promise<AdminMetrics> {
    const monthStart = startOfMonth(new Date());
    const yearStart = startOfYear(new Date());
    const trendStart = startOfMonth(subMonths(new Date(), 11));

    const [
      totalCustomers,
      activeCustomers,
      suspendedCustomers,
      activeSubscriptions,
      cancelledSubscriptions,
      monthRevAgg,
      yearRevAgg,
      failedPayments,
      trendAgg,
      planDistAgg,
    ] = await Promise.all([
      User.countDocuments({ role: ROLES.CUSTOMER }),
      User.countDocuments({ role: ROLES.CUSTOMER, status: USER_STATUS.ACTIVE }),
      User.countDocuments({ role: ROLES.CUSTOMER, status: USER_STATUS.SUSPENDED }),
      Subscription.countDocuments({ status: SUBSCRIPTION_STATUS.ACTIVE }),
      Subscription.countDocuments({ status: SUBSCRIPTION_STATUS.CANCELLED }),
      Payment.aggregate<{ total: number }>([
        {
          $match: {
            status: PAYMENT_STATUS.SUCCESS,
            paymentDate: { $gte: monthStart },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate<{ total: number }>([
        {
          $match: {
            status: PAYMENT_STATUS.SUCCESS,
            paymentDate: { $gte: yearStart },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.countDocuments({
        status: { $in: [PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CHARGEBACK] },
      }),
      Payment.aggregate<{ _id: string; total: number }>([
        {
          $match: {
            status: PAYMENT_STATUS.SUCCESS,
            paymentDate: { $gte: trendStart },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$paymentDate" } },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Subscription.aggregate<{ _id: string; count: number }>([
        { $match: { status: SUBSCRIPTION_STATUS.ACTIVE } },
        {
          $lookup: {
            from: "plans",
            localField: "planId",
            foreignField: "_id",
            as: "plan",
          },
        },
        { $unwind: "$plan" },
        { $group: { _id: "$plan.name", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    // Build a dense 12-month trend (fill gaps with 0).
    const trendMap = new Map(trendAgg.map((t) => [t._id, t.total]));
    const revenueTrend: { month: string; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, "yyyy-MM");
      revenueTrend.push({
        month: format(d, "MMM"),
        revenue: trendMap.get(key) ?? 0,
      });
    }

    return {
      totalCustomers,
      activeCustomers,
      suspendedCustomers,
      activeSubscriptions,
      cancelledSubscriptions,
      monthlyRevenue: monthRevAgg[0]?.total ?? 0,
      annualRevenue: yearRevAgg[0]?.total ?? 0,
      failedPayments,
      currency: "LKR",
      revenueTrend,
      planDistribution: planDistAgg.map((p) => ({ plan: p._id, count: p.count })),
    };
  },

  async recentPayments(limit = 10) {
    const payments = await Payment.find()
      .sort({ paymentDate: -1 })
      .limit(limit)
      .populate("userId", "firstName lastName email")
      .lean();
    return payments.map((p) => {
      const user = p.userId as unknown as {
        firstName?: string;
        lastName?: string;
        email?: string;
      } | null;
      return {
        id: String(p._id),
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        paymentDate: p.paymentDate,
        transactionId: p.transactionId,
        customer: user
          ? {
              name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
              email: user.email ?? "",
            }
          : null,
      };
    });
  },
};
