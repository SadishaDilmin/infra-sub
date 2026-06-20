# Deployment Guide

Target: **Vercel** (Next.js app) + **MongoDB Atlas** (database) + **PayHere** (payments).

---

## 1. MongoDB Atlas

1. Create a free/shared cluster (or dedicated for production).
2. **⚠️ Data residency (compliance):** choose the cluster **region** deliberately.
   Subscription data is personal data under UK/EU GDPR. If you serve UK/EU data
   subjects, host in a UK/EU region (e.g. `eu-west`/London) and record this in your
   ROPA. **Do not accept the default US region without a documented lawful basis.**
3. Create a database user with least privilege (readWrite on the `infra_sub` DB only).
4. Network access: add Vercel's egress (or `0.0.0.0/0` only if you must; prefer
   Atlas + Vercel private networking / IP allowlisting where possible).
5. Copy the SRV connection string → `MONGODB_URI`.

The app opens a pooled, cached connection (`maxPoolSize: 10`) suited to serverless.

---

## 2. PayHere

1. Sign up at https://www.payhere.lk and complete merchant verification.
2. **Sandbox first:** use `https://sandbox.payhere.lk/pay/checkout` and sandbox
   credentials; set `PAYHERE_MODE=sandbox`.
3. Get your **Merchant ID** and **Merchant Secret** (Dashboard → Settings → Domains &
   Credentials). The secret is server-only and used to compute/verify md5 signatures.
4. Add your domain(s) under **Allowed domains/apps** so checkout is permitted.
5. Set the **`notify_url`** to `https://YOUR_DOMAIN/api/webhooks/payhere`. This must be
   publicly reachable — PayHere calls it server-to-server. (Locally, use a tunnel such
   as `cloudflared`/`ngrok` and point `PAYHERE_NOTIFY_URL` at the tunnel URL.)
6. **Recurring cancellation (optional):** to cancel recurring subscriptions via API,
   create a **Business App** (Dashboard → Integrations → Create App) and set
   `PAYHERE_APP_ID` / `PAYHERE_APP_SECRET`. Without these, cancellation marks the
   subscription cancelled locally and surfaces a notice (recurring charges must then be
   stopped from the PayHere dashboard).
7. Go live: switch `PAYHERE_CHECKOUT_URL` to `https://www.payhere.lk/pay/checkout`,
   `PAYHERE_MODE=live`, and use live credentials.

### How the integration works
- Checkout hash is computed **server-side** with the merchant secret — never in the
  browser.
- The webhook `md5sig` is verified before any state change; payments are idempotent on
  `payment_id`. See [ARCHITECTURE.md](./ARCHITECTURE.md) §5.

---

## 3. Vercel

1. Push the repo to GitHub/GitLab and **Import Project** in Vercel (framework auto-detected
   as Next.js). Install the Vercel CLI for env management: `npm i -g vercel`.
2. **Environment variables** — add every var from `.env.example` for the *Production*
   (and *Preview*) environments. Generate secrets with `openssl rand -base64 48`:
   ```bash
   vercel env add JWT_ACCESS_SECRET production
   vercel env add JWT_REFRESH_SECRET production
   vercel env add CSRF_SECRET production
   vercel env add MONGODB_URI production
   vercel env add PAYHERE_MERCHANT_ID production
   vercel env add PAYHERE_MERCHANT_SECRET production
   # ...and the rest (PAYHERE_*, SMTP_*, NEXT_PUBLIC_APP_URL)
   ```
   Set `NEXT_PUBLIC_APP_URL`, `PAYHERE_NOTIFY_URL`, `PAYHERE_RETURN_URL`,
   `PAYHERE_CANCEL_URL` to your real production domain.
3. Deploy: `vercel --prod` (or push to your production branch).
4. **Seed production** once (locally, with production env in `.env.local`, pointed at the
   prod DB): `npm run seed` — creates the super admin + example plans. Then **rotate the
   seed admin password**.

> Functions run on Node.js (Fluid Compute). `mongoose`/`bcryptjs` are marked as
> `serverExternalPackages` in `next.config.mjs`. Middleware is Edge-safe (jose only).

---

## 4. Email (SMTP)

Set `SMTP_*` and `EMAIL_FROM` to a transactional provider (e.g. SES/SendGrid/Resend SMTP).
If SMTP is omitted, the app logs emails to the console instead of sending — fine for
local dev, **not** for production (verification & reset links won't be delivered).

---

## 5. Pre-launch checklist

- [ ] Atlas region matches data-residency obligations; least-privilege DB user.
- [ ] All secrets are strong, unique, and set in Vercel (not committed).
- [ ] `PAYHERE_MODE=live` + live credentials + allowed domains configured.
- [ ] `notify_url` reachable in production; test a sandbox end-to-end payment first.
- [ ] SMTP configured and a test verification/reset email received.
- [ ] Seed admin password rotated; consider removing/limiting seed usage in prod.
- [ ] **Rate limiting** moved to a shared store (Redis) — see [SECURITY.md](./SECURITY.md).
- [ ] Review [SECURITY.md](./SECURITY.md) hardening items and complete your DPIA/ROPA.

---

## 6. Data residency & compliance (summary)

| Concern | Where it's handled | Action for you |
|---|---|---|
| DB region | Atlas cluster | Choose UK/EU if serving UK/EU subjects; document it |
| Card data | PayHere (PCI scope) | Never logged/stored here; keep it that way |
| Audit trail | `auditlogs` (append-only) | Optionally enable Atlas write-once/audit |
| Secrets | Vercel env | Never echo/commit; rotate on suspicion of exposure |
| Personal data exports/erasure | app DB | Build DSAR/erasure workflows per your policy |

If any future change moves processing (DB, email, or a new AI/3rd-party service)
**outside your required region**, treat it as a compliance change and review before
shipping.
