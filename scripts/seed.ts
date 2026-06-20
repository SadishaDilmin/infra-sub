/**
 * Seed script: bootstraps a super admin and the example plans.
 *
 * Usage:  npm run seed
 *
 * Reads SEED_ADMIN_* and DB/JWT/PayHere vars from .env.local. Idempotent — it
 * skips records that already exist, so it is safe to re-run.
 */
import { loadEnvConfig } from "@next/env";

const EXAMPLE_PLANS = [
  {
    name: "Starter",
    description: "For individuals and small projects getting started.",
    monthlyPrice: 2500,
    yearlyPrice: 25000,
    features: [
      "1 environment",
      "5 GB storage",
      "Community support",
      "Daily backups",
    ],
    highlighted: false,
    sortOrder: 1,
  },
  {
    name: "Business",
    description: "For growing teams that need more power and support.",
    monthlyPrice: 7500,
    yearlyPrice: 75000,
    features: [
      "5 environments",
      "100 GB storage",
      "Priority email support",
      "99.9% uptime SLA",
      "Hourly backups",
    ],
    highlighted: true,
    sortOrder: 2,
  },
  {
    name: "Enterprise",
    description: "For organisations with advanced scale and compliance needs.",
    monthlyPrice: 20000,
    yearlyPrice: 200000,
    features: [
      "Unlimited environments",
      "1 TB storage",
      "24/7 dedicated support",
      "99.99% uptime SLA",
      "Custom integrations",
      "Audit logs & SSO",
    ],
    highlighted: false,
    sortOrder: 3,
  },
];

async function main() {
  loadEnvConfig(process.cwd());

  const [{ connectDB }, { User }, { Plan }, { hashPassword }, constants] =
    await Promise.all([
      import("@/lib/db/mongoose"),
      import("@/models/user.model"),
      import("@/models/plan.model"),
      import("@/lib/auth/password"),
      import("@/config/constants"),
    ]);

  await connectDB();

  // --- Super admin ---
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const existingAdmin = await User.findOne({ email });
  if (existingAdmin) {
    console.log(`✓ Admin already exists: ${email}`);
  } else {
    const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
    await User.create({
      firstName: process.env.SEED_ADMIN_FIRST_NAME ?? "Super",
      lastName: process.env.SEED_ADMIN_LAST_NAME ?? "Admin",
      email,
      password: await hashPassword(password),
      role: constants.ROLES.SUPER_ADMIN,
      status: constants.USER_STATUS.ACTIVE,
      emailVerifiedAt: new Date(),
    });
    console.log(`✓ Created super admin: ${email}`);
  }

  // --- Example plans ---
  for (const plan of EXAMPLE_PLANS) {
    const slug = plan.name.toLowerCase();
    const exists = await Plan.findOne({ slug });
    if (exists) {
      console.log(`✓ Plan already exists: ${plan.name}`);
      continue;
    }
    await Plan.create({
      ...plan,
      slug,
      currency: process.env.PAYHERE_CURRENCY ?? "LKR",
      active: true,
    });
    console.log(`✓ Created plan: ${plan.name}`);
  }

  console.log("\nSeed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
