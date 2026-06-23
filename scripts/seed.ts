/**
 * Seed script: bootstraps sample users (one per role + customer states) and the
 * example plans.
 *
 * Usage:  npm run seed
 *
 * Reads SEED_ADMIN_* and DB/JWT/PayHere vars from .env.local. Idempotent — it
 * skips records that already exist, so it is safe to re-run. All sample
 * accounts use the RFC-2606 reserved @example.com domain (synthetic, not real
 * people) — change the passwords before any non-local environment.
 */
// `@next/env` is CommonJS; under this package's ESM ("type": "module") the
// named export isn't statically detectable, so import the default and destructure.
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

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

  // --- Sample users (one per role, plus customer states for testing) ---
  const sampleUsers = [
    {
      firstName: process.env.SEED_ADMIN_FIRST_NAME ?? "Super",
      lastName: process.env.SEED_ADMIN_LAST_NAME ?? "Admin",
      email: (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase(),
      password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@2026",
      role: constants.ROLES.SUPER_ADMIN,
      status: constants.USER_STATUS.ACTIVE,
      verified: true,
    },
    {
      firstName: "Olivia",
      lastName: "Customer",
      email: "customer@example.com",
      password: "Customer@2026",
      role: constants.ROLES.CUSTOMER,
      status: constants.USER_STATUS.ACTIVE,
      verified: true,
    },
    {
      firstName: "Pat",
      lastName: "Pending",
      email: "pending@example.com",
      password: "Pending@2026",
      role: constants.ROLES.CUSTOMER,
      status: constants.USER_STATUS.PENDING,
      verified: false,
    },
    {
      firstName: "Sam",
      lastName: "Suspended",
      email: "suspended@example.com",
      password: "Suspended@2026",
      role: constants.ROLES.CUSTOMER,
      status: constants.USER_STATUS.SUSPENDED,
      verified: true,
    },
  ];

  for (const u of sampleUsers) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`✓ User already exists: ${u.email} (${u.role})`);
      continue;
    }
    await User.create({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      password: await hashPassword(u.password),
      role: u.role,
      status: u.status,
      emailVerifiedAt: u.verified ? new Date() : null,
    });
    console.log(`✓ Created ${u.role}: ${u.email}`);
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
