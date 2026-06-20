---
name: nextjs-saas
description: >-
  Conventions and copy-paste patterns for this Next.js 15 + MongoDB + JWT/RBAC +
  PayHere SaaS. Use when adding an API route, a feature module, a Mongoose model,
  an auth-protected page, a TanStack Query hook, or a payment/webhook flow — so new
  code matches the existing feature-based architecture and security defaults.
---

# Next.js SaaS — build conventions

This repo uses **feature-based architecture** with a strict layering:
`app/api` (HTTP) → `features/*/service` (logic) → `models` (data). Cross-cutting
concerns live in `lib/` and wrap every route. Follow these patterns exactly.

## Golden rules
- Route handlers stay thin: validate input with a Zod DTO, call a service, return
  via the envelope helpers. **No business logic in routes.**
- Services never import HTTP/Next types. They throw typed errors from `lib/errors.ts`.
- Validate **all** input with Zod DTOs (`features/<f>/<f>.dto.ts`). Infer TS types
  from the schema — don't hand-write duplicate interfaces.
- Never trust the client for money/state: payment truth comes from the verified
  webhook only. Never compute the PayHere hash client-side.
- Secrets are server-only (`config/env.ts`); never import `env` into a Client
  Component. Never log secrets or PII.
- Mongoose model docs that you `.save()` must be typed `HydratedDocument<XDoc>`,
  not the bare `InferSchemaType` shape.

## Add an API route

```ts
// src/app/api/things/route.ts
import { withApi } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { readJson } from "@/lib/api/request";
import { thingService } from "@/features/things/thing.service";
import { createThingSchema } from "@/features/things/thing.dto";
import { ROLES } from "@/config/constants";

export const runtime = "nodejs"; // anything touching Mongoose/bcrypt

export const GET = withApi(async ({ user }) => {
  return ok({ things: await thingService.list(user!.id) });
}, { auth: true });

export const POST = withApi(async ({ req, user }) => {
  const body = createThingSchema.parse(await readJson(req));
  return created({ thing: await thingService.create(user!.id, body) });
}, { roles: [ROLES.SUPER_ADMIN] });          // RBAC; CSRF auto-enforced on mutations
```

`withApi(handler, opts)` options: `{ auth?, roles?, csrf?, rateLimit? }`.
- `roles` implies `auth`. CSRF is on by default for POST/PUT/PATCH/DELETE — set
  `csrf:false` only for public/server-to-server endpoints (login, register, webhook).
- `rateLimit`: a preset key (`"AUTH" | "STRICT" | "API" | "WEBHOOK"`), an explicit
  `{limit, windowMs}`, or `false`.
- Handler receives `{ req, params, ip, user }`; `params` is already awaited.
- Throw `BadRequest/Unauthorized/Forbidden/NotFound/Conflict/...` from `lib/errors.ts`;
  the wrapper maps them. `ZodError` → 422 automatically.

## Add a feature module

```
src/features/things/
  thing.dto.ts       # Zod schemas + inferred types
  thing.service.ts   # business logic; only layer that imports the model
```
Service methods return plain serialised DTOs (map `_id`→`id`), accept a small ctx
`{ ip?, userAgent? }` when they audit, and call `audit({ action, ... })` for
security-relevant changes (add the action to `AUDIT_ACTIONS`).

## Add a Mongoose model

```ts
// src/models/thing.model.ts
import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const thingSchema = new Schema({ /* ... */ }, { timestamps: true });
export type ThingDoc = InferSchemaType<typeof thingSchema> & { _id: string };
export const Thing: Model<ThingDoc> =
  (models.Thing as Model<ThingDoc>) || model<ThingDoc>("Thing", thingSchema);
```
Use `models.X || model(...)` (avoids hot-reload OverwriteModelError). Add indexes for
every query filter and a **unique index** for any idempotency/uniqueness invariant.
For natural idempotency keys (e.g. external payment ids) catch duplicate-key (`code
11000`) and return the existing row.

## Auth-protected page

Server layout gates the area; client pages fetch via hooks.
```tsx
// src/app/things/layout.tsx (server)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE } from "@/config/constants";
export default async function Layout({ children }) {
  const store = await cookies();
  if (!store.get(AUTH_COOKIE.ACCESS) && !store.get(AUTH_COOKIE.REFRESH))
    redirect("/login?next=/things");
  return <>{children}</>;
}
```
Authoritative RBAC is still the API (`withApi({roles})`); the layout/middleware are
UI-level gates only. For admin areas also check `getSessionUser()` role in the layout.

## TanStack Query hook + API client

```ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client"; // adds CSRF header + auto-refresh on 401

export function useThings() {
  return useQuery({ queryKey: ["things"], queryFn: () => api.get<{things:Thing[]}>("/api/things") });
}
export function useCreateThing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateThingInput) => api.post("/api/things", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["things"] }),
  });
}
```
Import DTO **types** from service/dto files with `import type` (erased at build, so no
server code leaks into the client bundle).

## Forms

React Hook Form + `zodResolver(schema)` with the shadcn `Form/FormField/FormControl/
FormMessage` primitives. Reuse the DTO schema where possible. Any page using
`useSearchParams` must be wrapped in `<Suspense>` (Next 15 build requirement).

## PayHere (payments)

- Start checkout: service builds fields via `buildCheckoutFields()` (server computes
  the md5 hash), the client submits them with `submitPayhereCheckout()`.
- Webhook `/api/webhooks/payhere`: `verifyWebhookSignature()` → record payment
  idempotently → activate subscription → invoice → receipt. `csrf:false`, public.
- Recurring cancel needs Business-App creds (`PAYHERE_APP_ID/SECRET`); without them we
  cancel locally and surface a notice.

## UI primitives
shadcn/ui live in `src/components/ui`. Compose them; don't restyle from scratch. Dark
mode via `next-themes` (`ThemeToggle`), toasts via `sonner` (`toast.*`), charts via
`recharts`. Use `cn()` for class merging and `formatCurrency/formatDate` from
`lib/utils`.

## Security defaults (don't regress)
3-layer RBAC · refresh-token rotation + reuse detection · CSRF on mutations · Zod
validation · rate limits · append-only audit log · secrets server-only. The in-memory
rate limiter must be swapped for Redis in multi-instance/serverless production
(`lib/security/rate-limit.ts`). See `SECURITY.md`.

## Compliance lens
Subscription data is personal data (UK/EU GDPR). Flag — don't silently make — changes
that affect data residency (DB/email/3rd-party region), audit-log mutability, secret
handling, or anything that would auto-finalise a billing decision without a human.

## Verify before done
```bash
npm run typecheck && npm run build
```
Don't claim it works without one of these passing.
