import { z } from "zod";

/**
 * Centralised, validated environment configuration.
 *
 * Why: fail fast at boot with a clear message rather than at runtime with an
 * obscure `undefined`. Server secrets live here and must never be imported into
 * a Client Component — anything in this file is server-only.
 */
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().default("infra_sub"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be >= 32 chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be >= 32 chars"),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604800),
  JWT_ISSUER: z.string().default("infra-sub"),
  JWT_AUDIENCE: z.string().default("infra-sub-clients"),

  CSRF_SECRET: z.string().min(16, "CSRF_SECRET must be >= 16 chars"),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default("Infra Sub <no-reply@example.com>"),

  PAYHERE_MERCHANT_ID: z.string().min(1, "PAYHERE_MERCHANT_ID is required"),
  PAYHERE_MERCHANT_SECRET: z
    .string()
    .min(1, "PAYHERE_MERCHANT_SECRET is required"),
  PAYHERE_CHECKOUT_URL: z
    .string()
    .url()
    .default("https://sandbox.payhere.lk/pay/checkout"),
  PAYHERE_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYHERE_CURRENCY: z.enum(["LKR", "USD"]).default("LKR"),
  PAYHERE_NOTIFY_URL: z.string().url(),
  PAYHERE_RETURN_URL: z.string().url(),
  PAYHERE_CANCEL_URL: z.string().url(),
  // Optional: PayHere "Business App" credentials, required ONLY to cancel
  // recurring subscriptions via the Subscription Manager API. Without these we
  // cancel locally and surface a notice (see DEPLOYMENT.md → PayHere).
  PAYHERE_APP_ID: z.string().optional(),
  PAYHERE_APP_SECRET: z.string().optional(),
  PAYHERE_API_BASE: z
    .string()
    .url()
    .default("https://www.payhere.lk/merchant/v1"),

  // Which provider new checkouts use. Both webhook routes stay mounted.
  PAYMENT_PROVIDER: z.enum(["payhere", "polar"]).default("payhere"),

  // Polar (Merchant of Record). Optional so the app boots without them while
  // PAYMENT_PROVIDER=payhere; the Polar helpers throw a clear error if selected
  // without these set. POLAR_SERVER picks the sandbox vs production API host.
  POLAR_ACCESS_TOKEN: z.string().optional(),
  POLAR_WEBHOOK_SECRET: z.string().optional(),
  POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),

  RATE_LIMIT_REDIS_URL: z.string().optional(),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

function formatErrors(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
}

const parsedServer = serverSchema.safeParse(process.env);
if (!parsedServer.success) {
  throw new Error(
    `❌ Invalid server environment variables:\n${formatErrors(parsedServer.error)}`,
  );
}

const parsedPublic = publicSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
if (!parsedPublic.success) {
  throw new Error(
    `❌ Invalid public environment variables:\n${formatErrors(parsedPublic.error)}`,
  );
}

export const env = {
  ...parsedServer.data,
  ...parsedPublic.data,
} as const;

export type Env = typeof env;
