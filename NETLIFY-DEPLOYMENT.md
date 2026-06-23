# Netlify Deployment Guide — `app.sadishadilmin.com`

How to take **infra-sub** live on Netlify, with an isolated staging environment
and real PayHere payments. Stack: **Netlify** (Next.js 15) + **MongoDB Atlas**
+ **PayHere.lk** + **Upstash Redis** (rate limiting) + **SMTP** (email).

> Domain `sadishadilmin.com` is registered at **Spaceship**; sites are hosted on
> **Netlify** from connected GitHub repos. Your existing `www.sadishadilmin.com`
> site is separate and untouched — we only add the `app.` subdomain.

---

## 0. Fix these BEFORE real money flows (non-negotiable)

1. **Separate databases.** Staging and production must use **different Atlas
   clusters**. Sharing one risks a staging deploy wiping production payment
   records and commingles test data with real personal data (UK-GDPR).
2. **Rotate + replace secrets.** Rotate the Atlas password that was exposed.
   Replace every `dev_..._change_me` placeholder with strong unique values
   (`openssl rand -base64 48`). Secrets live only in Netlify env, never in git.
3. **Rate limiting needs Redis.** The in-memory limiter does nothing across
   serverless isolates — provision Upstash (§5).

---

## 1. MongoDB Atlas — two clusters

Create **two** clusters (free tier is fine for staging):

| | Production | Staging |
|---|---|---|
| Cluster | `prod-cluster` | `staging-cluster` |
| DB user | least-priv, `readWrite` on `infra_sub` only | separate least-priv user |
| Network access | Netlify egress / `0.0.0.0/0` if you must | same |
| Region | **UK/EU if you serve UK/EU data subjects** — document in your ROPA | match prod |

Copy each SRV string into the matching `MONGODB_URI`. The app uses a pooled,
cached connection (`maxPoolSize: 10`) suited to serverless.

---

## 2. Netlify — create the app site

1. **Production site:** Add new site → Import from GitHub → this `infra-sub`
   repo, **production branch = `main`**. This is separate from your `www` site.
2. **Staging site:** Add a *second* Netlify site from the same repo with
   **production branch = `staging`**. (Two sites keeps prod and staging fully
   isolated — separate env, separate domain, separate deploy logs.)
3. Build settings are read from [`netlify.toml`](./netlify.toml) (build
   `npm run build`, Node 20, `@netlify/plugin-nextjs`). Nothing to type.
4. First deploys will fail env validation until §4 vars are set — that's expected.

| Branch | Netlify site | Domain |
|---|---|---|
| `main` | production site | `app.sadishadilmin.com` |
| `staging` | staging site | `stage.sadishadilmin.com` |

The Next.js Runtime maps API routes → Netlify Functions (Node; Mongoose/bcrypt
declared as `serverExternalPackages`) and the `jose`-only middleware → an Edge
Function. No code changes needed for Netlify.

---

## 3. DNS at Spaceship — point `app` → Netlify

1. In each Netlify site: **Domain management → Add a domain** — `app.sadishadilmin.com`
   on the production site, `stage.sadishadilmin.com` on the staging site. Netlify
   shows each site's target like `your-site.netlify.app`.
2. Log in to **Spaceship → your domain → Advanced DNS / DNS records** and add one
   CNAME per environment (use each site's own Netlify target):

   | Type | Host | Value | TTL |
   |---|---|---|---|
   | `CNAME` | `app` | `prod-site.netlify.app` | Auto |
   | `CNAME` | `stage` | `staging-site.netlify.app` | Auto |

3. Back in Netlify, wait for verification → it auto-issues a Let's Encrypt TLS
   cert per domain. (Leave your `www`/apex records as they are.)

> Alternative: delegate DNS to **Netlify DNS** (point Spaceship nameservers at
> Netlify). Only do this if you want Netlify to manage all of `sadishadilmin.com`
> — the CNAME approach above is simpler and keeps your `www` site as-is.

---

## 4. Environment variables (per Netlify context)

Set in **Site config → Environment variables**, scoped to the right context.
Use [`.env.example`](./.env.example) (production) and
[`.env.staging.example`](./.env.staging.example) (staging) as the field lists.

| Variable | Production | Staging |
|---|---|---|
| `MONGODB_URI` | prod cluster | **staging cluster** |
| `NEXT_PUBLIC_APP_URL` | `https://app.sadishadilmin.com` | `https://stage.sadishadilmin.com` |
| `PAYHERE_MODE` | `live` *(after approval)* | `sandbox` |
| `PAYHERE_CHECKOUT_URL` | `https://www.payhere.lk/pay/checkout` | `https://sandbox.payhere.lk/pay/checkout` |
| `PAYHERE_MERCHANT_ID` / `_SECRET` | live creds | sandbox creds |
| `PAYHERE_NOTIFY_URL` | `https://app.sadishadilmin.com/api/webhooks/payhere` | `https://stage.sadishadilmin.com/api/webhooks/payhere` |
| `PAYHERE_RETURN_URL` / `_CANCEL_URL` | prod billing URLs | `stage.sadishadilmin.com` billing URLs |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `CSRF_SECRET` | strong, unique | **different** strong values |
| `SMTP_*`, `EMAIL_FROM` | Spacemail sender | Spacemail/test sender |
| `RATE_LIMIT_REDIS_URL` / `_TOKEN` | prod Upstash | staging Upstash |

---

## 5. Upstash Redis — make rate limiting real

1. Create an Upstash Redis database (one for prod, one for staging).
2. Copy the **REST URL** (`https://xxxx.upstash.io`) and **REST token**.
3. Set `RATE_LIMIT_REDIS_URL` + `RATE_LIMIT_REDIS_TOKEN` in the matching context.

When both are set the limiter uses Redis automatically; otherwise it falls back
to per-instance memory (dev only). It **fails open** if Redis is unreachable so
an outage can't lock users out — see [`rate-limit.ts`](./src/lib/security/rate-limit.ts).

---

## 6. PayHere — sandbox now, live after approval

You're **sandbox-only** today, so:

**Now (sandbox, both staging + a prod dry-run):**
- Keep `PAYHERE_MODE=sandbox` + `sandbox.payhere.lk`.
- Add your domain(s) under PayHere **Allowed Domains/Apps**.
- Run a full sandbox payment and confirm the webhook recorded the payment +
  created the invoice + sent the receipt.

**To take REAL payments (after PayHere approval):**
1. Complete PayHere **merchant verification** + add your **bank account**.
2. Get **live** Merchant ID + Secret; add `app.sadishadilmin.com` to allowed domains.
3. Flip production env: `PAYHERE_MODE=live`,
   `PAYHERE_CHECKOUT_URL=https://www.payhere.lk/pay/checkout`, live creds.
4. (Optional, recurring cancel) create a **Business App** → `PAYHERE_APP_ID/SECRET`.
5. Do **one small real payment** end-to-end before announcing.

Signing is server-side and webhook `md5sig` is verified before any state change
— don't change that. See [DEPLOYMENT.md](./DEPLOYMENT.md) §2 and ARCHITECTURE §5.

---

## 7. Email (SMTP via Spacemail) — required for production

Verification, password reset, and receipts need real SMTP. You're on
**Spacemail** (Spaceship), so:

1. In Spaceship → **Spacemail**, create a mailbox on `sadishadilmin.com`, e.g.
   `no-reply@sadishadilmin.com`.
2. Set the env:
   - `SMTP_HOST=mail.spacemail.com`
   - `SMTP_PORT=465` + `SMTP_SECURE=true` (SSL) — or `587` + `SMTP_SECURE=false` (STARTTLS)
   - `SMTP_USER=no-reply@sadishadilmin.com` (the full mailbox address)
   - `SMTP_PASSWORD=<mailbox password>`
   - `EMAIL_FROM="Infra Sub <no-reply@sadishadilmin.com>"`
3. Add SPF/DKIM DNS records as Spacemail instructs (improves deliverability so
   verification links don't land in spam).

Without `SMTP_*` the app only logs emails. Send yourself a test verification +
reset after deploy.

---

## 8. Seed production (once)

Locally, point `.env.local` at the **production** DB and run `npm run seed`
(creates the super admin + example plans). Then **rotate the seed admin
password**. Do **not** seed the dev `@example.com` sample users into prod.

---

## 9. The "Get services" button on `www.sadishadilmin.com`

That site is a separate repo. Add a link to the app's sign-up entry:

```html
<a href="https://app.sadishadilmin.com/register">Get started</a>
<!-- or /pricing to show plans first -->
```

No cookie/CORS changes needed — auth happens entirely on the `app.` subdomain.

---

## 10. GitHub CI & branch model

Two workflows run automatically (no setup needed — they're in the repo):

- [`.github/workflows/build.yml`](./.github/workflows/build.yml) — typecheck +
  lint + production build (with throwaway CI env; never connects out).
- [`.github/workflows/security.yml`](./.github/workflows/security.yml) — gitleaks
  secret scan, Semgrep SAST, `npm audit`, plus CodeQL + dependency-review (these
  two auto-skip on private repos; enable a public repo or GitHub Advanced
  Security to use them).

**Branch model:** open PRs into `main` (→ prod) and `staging` (→ stage). Both
workflows gate every PR and push to those branches; Netlify deploys after merge.

**Recommended GitHub settings (repo → Settings):**
- Create the `staging` branch (only `main` exists today).
- **Branches → branch protection** on `main` (and `staging`): require the
  *Build* and *Security* checks to pass before merge; require a PR.
- **Secrets/variables → Actions:** none are needed for these workflows (build
  uses inline CI placeholders). Keep all real secrets in **Netlify**, not GitHub.
- **Code security:** enable secret scanning + push protection (a second net for
  the kind of credential that was pasted earlier).

## 11. Go-live checklist

- [ ] Two Atlas clusters; prod region documented in ROPA
- [ ] Atlas password rotated; all secrets strong/unique, in Netlify only
- [ ] `app.sadishadilmin.com` resolves with valid TLS
- [ ] Upstash Redis set for prod + staging
- [ ] SMTP verified (received a real test email)
- [ ] Sandbox payment OK end-to-end → (after approval) one live payment OK
- [ ] Seed admin password rotated
- [ ] Reviewed [SECURITY.md](./SECURITY.md) hardening items; DPIA/ROPA complete
