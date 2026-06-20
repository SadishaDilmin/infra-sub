# Infra Sub — Subscription Management Platform

A production-ready SaaS for selling **infrastructure-service subscriptions**, built with
Next.js 15 (App Router), TypeScript, MongoDB/Mongoose, JWT auth with refresh-token
rotation + RBAC, and **PayHere** (Sri Lanka) recurring payments.

Customers self-serve: register → verify email → subscribe → pay with PayHere →
manage/upgrade/cancel → view invoices & payment history. Admins manage plans,
customers, and see revenue analytics.

> Replaces manual bank transfers with automated, tracked, recurring billing.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Compliance notes](#compliance-notes)

---

## Features

**Customer**
- Register, login, logout, email verification, forgot/reset password
- Subscribe to a plan and pay via PayHere (monthly or yearly, recurring)
- View current subscription, status, next billing date
- Upgrade / change plan, cancel subscription
- Invoices and full payment history
- Profile + password management, dark mode

**Super Admin**
- Create / edit / delete plans (unlimited, dynamic, stored in MongoDB)
- Customer list with search/filter; suspend / reactivate
- Revenue analytics (MRR, ARR, 12-month trend, plan mix), active/cancelled
  subscriptions, failed payments
- Global payment history

**Platform**
- JWT access tokens (short-lived) + **refresh-token rotation with reuse detection**
- Role-based access control (RBAC) enforced at middleware **and** every API route
- Rate limiting, CSRF protection, secure headers, Zod input validation
- **Idempotent** PayHere webhook handling (no duplicate payments/invoices)
- Append-only **audit log** for security/compliance events

---

## Tech stack

| Layer      | Choice |
|------------|--------|
| Framework  | Next.js 15 (App Router, Route Handlers), React 19, TypeScript |
| Styling/UI | Tailwind CSS, shadcn/ui (Radix), lucide-react, next-themes, sonner |
| Data       | TanStack Query (client), React Hook Form + Zod (forms/validation) |
| Database   | MongoDB Atlas, Mongoose 8 |
| Auth       | `jose` (JWT, Edge-safe), `bcryptjs` (hashing), httpOnly cookies |
| Payments   | PayHere checkout + recurring + webhook (md5sig verified) |
| Charts     | Recharts |
| Deploy     | Vercel (app) + MongoDB Atlas (DB) |

---

## Quick start

Prerequisites: **Node 20+**, a MongoDB connection string (local or Atlas), and a
PayHere sandbox account.

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local
#    → fill in MONGODB_URI, JWT_* secrets (openssl rand -base64 48),
#      CSRF_SECRET, PAYHERE_* (sandbox), and SMTP_* (optional for dev)

# 3. Seed a super admin + example plans (Starter/Business/Enterprise)
npm run seed

# 4. Run
npm run dev      # http://localhost:3000
```

Default seeded admin: the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` you set in
`.env.local`. Log in at `/login` and you'll land on `/admin`.

Other scripts:

```bash
npm run build       # production build
npm run start       # run the production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

### Testing PayHere locally

PayHere's webhook (`notify_url`) must reach your server. For local testing,
expose your dev server with a tunnel (e.g. `cloudflared tunnel` / `ngrok`) and set
`PAYHERE_NOTIFY_URL` to the public URL + `/api/webhooks/payhere`. Use PayHere
**sandbox** credentials and test cards. See [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Environment variables

All variables are documented in [`.env.example`](./.env.example) and validated at
boot in [`src/config/env.ts`](./src/config/env.ts) (the app fails fast with a clear
message if any required var is missing/invalid). See
[DEPLOYMENT.md](./DEPLOYMENT.md) for production setup.

---

## Project structure

```
src/
  app/                       # Next.js App Router
    (marketing)/             # landing + pricing (public)
    (auth)/                  # login, register, forgot/reset, verify-email
    dashboard/               # customer area (layout guards session)
    admin/                   # super-admin area (layout guards role)
    api/                     # Route Handlers (REST API)
  config/                    # env validation + domain constants/enums
  features/                  # FEATURE-BASED modules (the business logic)
    auth/                    #   <feature>.dto.ts  (Zod DTOs)
    plans/                   #   <feature>.service.ts (business logic)
    subscriptions/
    payments/
    invoices/
    users/
    analytics/
  lib/                       # cross-cutting infrastructure
    api/                     #   route handler wrapper, response envelope, request utils
    auth/                    #   jwt, password, cookies, session, tokens
    payhere/                 #   checkout hashing, webhook verify, subscription mgr
    security/                #   rate-limit, csrf
    email/, audit/, db/      #   email, audit log, mongoose connection
  models/                    # Mongoose schemas (User, Plan, Subscription, ...)
  components/                # UI: ui/ (shadcn primitives), shared/, dashboard/, admin/, marketing/
  hooks/                     # TanStack Query hooks (use-auth, use-billing, use-admin)
  providers/                 # Theme + Query + Toaster providers
  middleware.ts              # edge route protection + redirects
scripts/seed.ts             # bootstrap admin + plans
```

**Architecture principle:** `app/` (HTTP) → `features/*/service` (business logic) →
`models/` (data). Cross-cutting concerns (auth, RBAC, CSRF, rate limiting, error
mapping) live in `lib/api/handler.ts` and wrap every route, keeping services pure.

---

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — layers, data model, request lifecycle, decisions
- [API.md](./API.md) — every endpoint, auth, request/response shapes
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Vercel + Atlas + PayHere, env, production hardening
- [SECURITY.md](./SECURITY.md) — OWASP mapping, auth design, and what to harden before prod

---

## Compliance notes

This codebase flags (rather than silently decides) choices with data-protection
impact, because subscription data is personal data under UK/EU GDPR:

- **Data residency** — pick your MongoDB Atlas region to match your obligations
  (UK/EU for UK/EU data subjects). See DEPLOYMENT.md → *Data residency*.
- **Audit log** is append-only by design; the service exposes no update/delete.
- **PayHere** handles card data; this app never stores PANs (only payment results).

These are starting points — complete your own DPIA/ROPA before going live.
