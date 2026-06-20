# Architecture

## 1. Layered design

The codebase is organised by **feature** with a strict dependency direction:

```
  HTTP boundary           Business logic            Persistence
┌────────────────┐      ┌──────────────────┐      ┌──────────────┐
│ app/api/**     │ ───▶ │ features/*/service│ ───▶ │ models/**    │
│ (Route Handler)│      │  (+ *.dto.ts Zod) │      │ (Mongoose)   │
└────────────────┘      └──────────────────┘      └──────────────┘
        ▲                        ▲
        │ wraps                  │ uses
┌────────────────┐      ┌──────────────────┐
│ lib/api/handler│      │ lib/** (jwt,      │
│  (withApi)     │      │  payhere, email,  │
└────────────────┘      │  audit, security) │
                        └──────────────────┘
```

- **Route handlers** (`app/api/**/route.ts`) are thin: parse + validate input,
  call a service, shape the response. They never contain business rules.
- **Services** (`features/*/*.service.ts`) hold all business logic and are the only
  layer that touches models. They throw typed `AppError`s; they know nothing about
  HTTP.
- **Models** (`models/*.model.ts`) are Mongoose schemas — the single source of
  truth for the data shape and indexes.
- **`lib/`** is cross-cutting infrastructure shared by services and handlers.

This separation follows SOLID/Separation-of-Concerns: you can unit-test a service
without HTTP, swap the rate-limiter backend without touching routes, etc.

## 2. The request lifecycle (API)

Every API route is wrapped by **`withApi`** ([src/lib/api/handler.ts](./src/lib/api/handler.ts)),
which runs these cross-cutting concerns in order:

1. **DB connect** — `connectDB()` (cached, serverless-safe singleton).
2. **Rate limit** — per route+IP, using a preset (`AUTH`, `STRICT`, `API`, `WEBHOOK`).
3. **CSRF** — on mutating methods, validates the signed double-submit token.
4. **AuthN/AuthZ** — verifies the access-token cookie; enforces `roles` (RBAC).
5. **Handler** — your code runs with `{ req, params, ip, user }`.
6. **Error mapping** — `ZodError` → 422, `AppError` → its status, else 500. All
   responses use the envelope `{ success, data | error }`.

```ts
export const POST = withApi(
  async ({ req, user }) => { /* ... */ return created({ plan }); },
  { roles: [ROLES.SUPER_ADMIN] },
);
```

## 3. Authentication & sessions

- **Access token** (JWT, ~15 min) — httpOnly cookie `isub_at`. Carries `sub`, `role`, `email`.
- **Refresh token** (JWT, ~7 days) — httpOnly cookie `isub_rt`, scoped to `/api/auth`.
  Each refresh is **rotated**; the DB stores only a SHA-256 hash of each token in a
  `familyId` chain.
- **Reuse detection** — presenting a revoked (already-rotated) refresh token revokes
  the whole family and forces re-login. Stolen-token replay is contained.
- **CSRF token** — non-httpOnly cookie `isub_csrf` (signed). The SPA echoes it in the
  `x-csrf-token` header on mutations (double-submit pattern).
- `jose` is used (not `jsonwebtoken`) so the same verification runs in the Edge
  middleware and the Node runtime.

Three layers of authorization (defence in depth):
1. **Middleware** ([src/middleware.ts](./src/middleware.ts)) — fast redirect for
   obviously-unauthenticated/role-mismatched page requests.
2. **Server layouts** (`dashboard`, `admin`) — session/role gate before render.
3. **API `withApi({ roles })`** — the authoritative check on every data operation.

## 4. Data model

| Collection | Purpose | Key indexes / invariants |
|---|---|---|
| `users` | accounts | unique `email`; `password` is `select:false` |
| `plans` | dynamic plans | unique `slug`; `active` |
| `subscriptions` | customer↔plan | **partial unique** (one non-terminal sub per user); price snapshot |
| `payments` | gateway results | **unique `payherePaymentId`** (idempotency) |
| `invoices` | one per payment | unique `invoiceNumber`, unique `paymentId` |
| `refreshtokens` | RT rotation | unique `tokenHash`, TTL on `expiresAt` |
| `verificationtokens` | email/reset | hashed token, TTL |
| `auditlogs` | append-only events | indexed by `action`, `actorId` |
| `counters` | atomic sequences | invoice/order numbering |

Subscriptions store a **price snapshot** (`amount`, `currency`, `interval`) so historic
billing is stable even if the plan's price later changes.

## 5. PayHere payment flow

```
Customer clicks Subscribe
  → POST /api/subscriptions  (server creates PENDING subscription + order_id,
                              computes md5 checkout hash with merchant secret)
  → browser auto-submits a form to PayHere checkout (hash never computed client-side)
  → user pays on PayHere
  → PayHere → POST /api/webhooks/payhere   (server-to-server, signed with md5sig)
        verify md5sig  →  record Payment (idempotent on payment_id)
                      →  activate Subscription + set nextBillingDate
                      →  generate Invoice  →  email receipt
  → browser returns to /dashboard/billing?status=success  (UI hint only)
```

**The webhook is the only source of truth.** The browser `return_url` is never
trusted to mark a payment successful. Recurring renewals arrive as further webhooks
and are matched by `payhereSubscriptionId` (falling back to `order_id`).

Idempotency is layered: md5sig verification + unique `payherePaymentId` + side-effects
gated on "was this payment newly created?".

## 6. Frontend

- **Server Components** for shells/layouts (session gating, no client JS cost).
- **Client Components** for interactive pages, using **TanStack Query** for data and
  a small fetch client ([src/lib/api/client.ts](./src/lib/api/client.ts)) that attaches
  the CSRF header and **transparently refreshes** the access token once on a 401.
- **React Hook Form + Zod** for all forms — the same DTO schemas used by the API.
- **shadcn/ui** primitives in `components/ui`, dark mode via `next-themes`, toasts via
  `sonner`, charts via `recharts`.

## 7. Key decisions

- **`bcryptjs` over `bcrypt`** — pure JS, no native build on Vercel.
- **`jose` over `jsonwebtoken`** — Edge-runtime compatible for middleware.
- **Refresh rotation in DB (hashed)** — enables reuse detection + remote logout;
  password changes bump `tokenVersion` and revoke all sessions.
- **Service-thrown typed errors** — single mapping point; no HTTP leakage into logic.
- **In-memory rate limiter by default** — correct for one instance; swap to Redis for
  serverless/multi-instance (see [SECURITY.md](./SECURITY.md)).
