# API Reference

Base URL: `${NEXT_PUBLIC_APP_URL}/api`

## Conventions

**Response envelope** — every endpoint returns one of:

```jsonc
{ "success": true,  "data": { /* ... */ } }
{ "success": false, "error": { "code": "STRING", "message": "Human readable", "details": {} } }
```

**Auth** — session is carried in httpOnly cookies (`isub_at` access, `isub_rt` refresh).
Mutating requests (`POST/PUT/PATCH/DELETE`) on authenticated endpoints must include the
CSRF header `x-csrf-token: <value of isub_csrf cookie>`. The browser client does this
automatically.

**Roles** — `CUSTOMER` (default) or `SUPER_ADMIN`. Admin endpoints require `SUPER_ADMIN`.

**Errors** — `400` bad request, `401` unauthorized, `403` forbidden/CSRF, `404` not
found, `409` conflict, `422` validation (`details` = field errors), `429` rate limited,
`402` payment error, `500` internal.

**Rate limits** — auth `10/min`, sensitive (reset/verify) `5/min`, general `120/min`,
webhook `300/min`, per IP+route.

---

## Auth

### `POST /api/auth/register`
Public. Creates a `CUSTOMER` (status `PENDING`) and emails a verification link.
```jsonc
// body
{ "firstName": "Jane", "lastName": "Doe", "email": "jane@x.com", "password": "Str0ngPass" }
// 201 → { "user": { id, firstName, lastName, email, role, status, emailVerified, createdAt } }
```
Password policy: ≥8 chars, upper + lower + number.

### `POST /api/auth/login`
Public. Sets session cookies on success.
```jsonc
{ "email": "jane@x.com", "password": "Str0ngPass" }
// 200 → { "user": {...}, "csrfToken": "..." }
// 401 invalid credentials · 403 account suspended
```

### `POST /api/auth/refresh`
Reads the refresh cookie, rotates it, returns a new session. Reuse of a rotated token
revokes the whole family.
```jsonc
// 200 → { "user": {...}, "csrfToken": "..." }   // 401 if invalid/expired
```

### `POST /api/auth/logout`
Revokes the refresh-token family and clears cookies. `200 → { ok: true }`

### `GET /api/auth/me`
Auth required. `200 → { "user": {...} }`

### `POST /api/auth/forgot-password`
Public. Always returns success (no user enumeration). Emails a reset link if the
account exists. `{ "email": "..." }`

### `POST /api/auth/reset-password`
Public. `{ "token": "...", "password": "NewStr0ng" }` → consumes token, revokes all
sessions, sets new password.

### `POST /api/auth/verify-email`
Public. `{ "token": "..." }` → activates the account.

### `POST /api/auth/resend-verification`
Public. `{ "email": "..." }` → resends link if unverified.

---

## Plans

### `GET /api/plans`
Public. Active plans for the pricing page.
```jsonc
// 200 → { "plans": [ { id, name, slug, description, monthlyPrice, yearlyPrice,
//                       currency, features[], highlighted, sortOrder, active } ] }
```

### `GET /api/admin/plans` · `SUPER_ADMIN`
All plans (incl. inactive).

### `POST /api/admin/plans` · `SUPER_ADMIN`
```jsonc
{ "name": "Business", "description": "...", "monthlyPrice": 7500, "yearlyPrice": 75000,
  "currency": "LKR", "features": ["..."], "highlighted": true, "sortOrder": 2, "active": true }
// 201 → { "plan": {...} }
```

### `PATCH /api/admin/plans/:id` · `SUPER_ADMIN`
Partial update (any subset of the create fields). `200 → { "plan": {...} }`

### `DELETE /api/admin/plans/:id` · `SUPER_ADMIN`
Refuses (`409`) if the plan has active subscriptions — deactivate instead.

---

## Subscriptions

### `GET /api/subscriptions`
Auth. Current (non-terminal) subscription with plan summary, or `null`.

### `POST /api/subscriptions`
Auth. Starts a checkout. Returns PayHere form fields to submit from the browser.
```jsonc
{ "planId": "<id>", "interval": "MONTHLY" }  // or "YEARLY"
// 201 → { "checkout": { subscriptionId, orderId, actionUrl, fields: { ...payhere fields, hash } } }
// 409 if you already have an active subscription (use /change)
```

### `POST /api/subscriptions/change`
Auth. Cancels the current recurring subscription and returns a new checkout for the
target plan. `{ "planId": "<id>", "interval": "MONTHLY" }`

### `POST /api/subscriptions/cancel`
Auth. Cancels the current subscription (calls PayHere if Business-App creds set).
```jsonc
// 200 → { "subscription": { id, status: "CANCELLED", endedAt, payhereNotice? } }
```

---

## Payments & Invoices

### `GET /api/payments?page=1&limit=20`
Auth. Caller's payment history (paginated).

### `GET /api/invoices?page=1&limit=20`
Auth. Caller's invoices (paginated).

### `GET /api/invoices/:id`
Auth. A single invoice owned by the caller (`404` otherwise).

### `GET /api/dashboard`
Auth. Customer dashboard summary:
```jsonc
{ "subscription": {...|null}, "totals": { totalPaid, count },
  "recentInvoices": [...], "recentPayments": [...] }
```

---

## Profile

### `PATCH /api/profile`
Auth. `{ firstName?, lastName?, phone? }` → updated user.

### `POST /api/profile/password`
Auth. `{ currentPassword, newPassword }` → changes password, revokes other sessions.

---

## Admin

### `GET /api/admin/metrics` · `SUPER_ADMIN`
```jsonc
{ "metrics": { totalCustomers, activeCustomers, suspendedCustomers, activeSubscriptions,
               cancelledSubscriptions, monthlyRevenue, annualRevenue, failedPayments,
               currency, revenueTrend:[{month,revenue}], planDistribution:[{plan,count}] },
  "recentPayments": [ { id, amount, currency, status, paymentDate, transactionId,
                        customer:{name,email} } ] }
```

### `GET /api/admin/customers?page=&search=&status=` · `SUPER_ADMIN`
Paginated customers with their current subscription status.

### `PATCH /api/admin/customers/:id/status` · `SUPER_ADMIN`
`{ "action": "suspend" | "reactivate" }` → suspending also force-logs-out the customer.

### `GET /api/admin/payments?page=&status=` · `SUPER_ADMIN`
Global payment history.

---

## Webhook

### `POST /api/webhooks/payhere`
**Public, server-to-server.** No cookies/CSRF; authenticity is the PayHere `md5sig`.
Content type `application/x-www-form-urlencoded`. Always returns `200` for accepted
notifications (so PayHere stops retrying); returns `403` only on signature failure.

Verifies signature → records the payment idempotently (unique `payment_id`) → on
success activates the subscription, generates an invoice, and emails a receipt; on
failure marks the subscription past-due. Configure this URL as your PayHere
`notify_url`.
