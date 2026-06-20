# Security

This platform follows OWASP best practices. Below is what is implemented, where, and
what you should harden before production.

## Controls implemented

| Area | Control | Location |
|---|---|---|
| Password storage | bcrypt (cost 12), `select:false` hash | `lib/auth/password.ts`, `models/user.model.ts` |
| Sessions | Short-lived JWT access + rotating refresh tokens | `lib/auth/jwt.ts`, `features/auth/auth.service.ts` |
| Token theft | Refresh **reuse detection** → family revocation | `auth.service.refresh` |
| Session storage | httpOnly + Secure + SameSite=strict cookies | `lib/auth/cookies.ts` |
| RBAC | Role checks at middleware, server layouts, and every API | `middleware.ts`, `lib/api/handler.ts` |
| CSRF | Signed double-submit token (`x-csrf-token`) | `lib/security/csrf.ts`, `lib/api/handler.ts` |
| Rate limiting | Fixed-window per IP+route, presets | `lib/security/rate-limit.ts` |
| Input validation | Zod DTOs on every mutating endpoint | `features/*/*.dto.ts` |
| Output/secret hygiene | Env validated; secrets never logged | `config/env.ts`, `lib/logger.ts` |
| Secure headers | HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy | `next.config.mjs` |
| Webhook integrity | PayHere `md5sig` verification + idempotency | `lib/payhere/payhere.ts`, `features/payments/webhook.service.ts` |
| Audit logging | Append-only security/compliance events | `lib/audit/audit.ts`, `models/audit-log.model.ts` |
| User enumeration | Generic login + always-OK forgot-password | `auth.service` |
| Timing attacks | Constant-time compares for tokens/signatures | `lib/auth/tokens.ts`, `csrf.ts`, `payhere.ts` |

### OWASP Top 10 mapping (abridged)
- **A01 Broken Access Control** — 3-layer RBAC; ownership checks in services
  (e.g. invoices are queried by `{ _id, userId }`).
- **A02 Cryptographic Failures** — bcrypt; HS256 JWT with separate access/refresh
  secrets; only token *hashes* stored.
- **A03 Injection** — Mongoose with typed schemas + Zod validation; no string-built
  queries.
- **A04 Insecure Design** — webhook-as-source-of-truth; idempotent payments; price
  snapshots.
- **A05 Misconfiguration** — fail-fast env validation; security headers; `poweredByHeader:false`.
- **A07 Auth Failures** — rotation, reuse detection, lockout via rate limits, password
  policy, email verification.
- **A08 Integrity Failures** — signed webhooks; signed CSRF tokens.
- **A09 Logging Failures** — structured logs + append-only audit trail (no secrets).

## Hardening required before production

These are deliberately left as explicit follow-ups (don't skip them):

1. **Rate limiting → shared store.** The default limiter is in-memory and only correct
   for a single instance. On Vercel (many instances), move to **Upstash Redis** (or
   Vercel KV/marketplace Redis). Keep the `enforceRateLimit` interface; swap the backend
   in `lib/security/rate-limit.ts`. Wire `RATE_LIMIT_REDIS_URL`.
2. **WAF / bot protection.** Enable Vercel Firewall / BotID for the auth and webhook
   routes; consider a managed ruleset and Attack Mode for incidents.
3. **CSP.** Add a strict `Content-Security-Policy` header (nonce-based) once you've
   inventoried inline scripts/styles. Not enabled by default to avoid breaking dev.
4. **Audit-log immutability.** The app exposes no update/delete for audit logs. For
   stronger guarantees, restrict the DB user to `insert`+`find` on `auditlogs` and/or
   enable Atlas auditing / write-once storage.
5. **Email verification gating.** Verification is implemented and flips the account to
   `ACTIVE`. If you require verified email *before purchase*, enforce
   `emailVerifiedAt` in `subscriptionService.createCheckout`.
6. **Secret rotation.** Rotate JWT/CSRF secrets and the PayHere secret on any suspected
   exposure. Rotating `JWT_*` invalidates existing sessions (by design).
7. **Dependency & monitoring.** Enable Dependabot/`npm audit` in CI, and ship logs to an
   observability tool. Alert on `TOKEN_REUSE_DETECTED`, `WEBHOOK_REJECTED`,
   `PAYMENT_FAILED`, and bursts of `USER_LOGIN_FAILED`.

## Reporting

For a real deployment, publish a `security.txt` and a private disclosure channel. Never
include real client PII or secrets in bug reports or commits.
