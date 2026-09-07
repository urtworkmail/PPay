# Changelog

All notable changes to PPay are logged here, one entry per pushed version.

## v3 — Stripe-parity architecture rebuild (in progress)

Multi-phase rebuild bringing PPay onto a single `PaymentIntent` orchestration core,
matching Stripe's actual architecture and workflows (see
`pakistan_payments_platform_architecture.md` and the phased plan). Logged per phase
as each lands.

### Phase 1 — Data model unification & test/live schema separation

#### Added
- **Sandbox/production schema separation**: two real Postgres schemas (`sandbox`,
  `production`) instead of a boolean flag. All transactional/catalog tables
  (checkout sessions, transactions, products, prices, subscriptions, saved payment
  methods, invoices, payment links, refunds, webhook endpoints/logs, settlements,
  API keys) are now schema-separated via SQLAlchemy `schema_translate_map`, resolved
  once per request from the API key prefix (`sk_sandbox_`/`sk_live_`) or the
  dashboard's `X-Mode` header — never re-checked per query. Account-level identity
  tables (`merchants`, `users`, `sessions`, `live_access_requests`) stay in the
  shared `public` schema, since a merchant holds both test and live key material on
  one row.
- **New entities**: `Customer`, `PaymentIntent`, `Charge`, `Coupon`, `Discount`,
  `Dispute`, `LedgerEntry`, `ReconciliationRecord`, `Event` — laying the schema
  groundwork for the orchestrator, reconciliation engine, refunds/disputes, and
  coupons work in later phases. Not yet wired into any request flow.
- **Mode-prefixed public references** (`cs_sandbox_...`, `plink_live_...`,
  `inv_sandbox_...`): checkout sessions, payment links, and invoices now expose
  this as their `id` in every API response and URL, so an anonymous buyer's browser
  hitting a public pay page can be routed to the correct schema with no API key
  present. A reference decoded against the wrong mode 404s the same way a
  nonexistent id would.
- `customer_id` bridge column (nullable) added to `checkout_sessions`, `invoices`,
  `saved_payment_methods`, ahead of the real `Customer` entity being wired in.

#### Database
- `0a071415ddaf` — create `sandbox`/`production` schemas, move all existing
  (sandbox/demo) data into `sandbox`, create the 9 new Phase 1 tables in both
  schemas, add `customer_id` to the 3 bridged tables and `event_id` to
  `webhook_logs`. Local dev DB was rebuilt from scratch and demo data
  re-seeded (`scripts/seed_demo.py`) while getting this migration right —
  no production data existed to lose.

#### Fixed
- Background jobs (`webhook_retry`, `nightly_settlement`, `process_due_payouts`,
  `subscription_billing`) now run once per mode (sandbox and production). They
  previously used a single hardcoded session and would have silently never
  touched live-mode data once Phase 1's schema separation landed.

### Phase 2 — PaymentIntent/Charge orchestrator (in progress)

#### Added
- `app/services/payment_intent_engine.py`: the orchestration entry point —
  `get_or_create_payment_intent` (idempotency-key-keyed get-or-create, so a
  checkout session retried after a validation error doesn't collide with
  itself) and `record_charge_attempt`, which implements the §5.1 state machine
  including the `requires_reconciliation` ambiguous state. A rail response
  tagged `failure_reason="timeout"` now lands on `requires_reconciliation`
  instead of being indistinguishable from an ordinary decline — verified live
  against the sandbox wallet-timeout test number (`03000000002`).
- Checkout's pay endpoint and subscription off-session billing
  (`charge_subscription_cycle`) both now write a `PaymentIntent`/`Charge` pair
  alongside their existing `Transaction` write (dual-write) — the dashboard
  keeps reading `Transaction` unmodified while `PaymentIntent`/`Charge` data
  accumulates in parallel.
- `Charge.refunded_amount_minor` (`d8a91c3e5f7b`): the one place the dual-write
  had gone silently stale — `transactions.py`'s refund endpoint updated
  `Transaction`/`Refund` but never touched the `Charge` it was dual-written
  alongside, so a refunded transaction's `Charge` kept claiming to be fully,
  unrefundedly `succeeded`. `payment_intent_engine.apply_refund` mirrors the
  refund onto the matching charge — same shape as Stripe's own (`Charge` stays
  `succeeded`, the refunded amount accumulates in its own field) — verified
  against a real refund: `Charge.status` stays `SUCCEEDED`,
  `refunded_amount_minor` matches the refund.

#### Pending (rest of Phase 2)
- Cut the dashboard's Payments list/detail view over to read from
  `PaymentIntent`/`Charge` (full timeline: intent → charge attempts → rail
  response → refunds/disputes → ledger breakdown, per spec §13.6), then retire
  the `Transaction` write.
- Wire payment links / invoices (they already route through the checkout pay
  endpoint, so they get the dual-write for free, but haven't been separately
  verified).

### Phase 3 — No-delete data policy, platform super admin, audit log

#### Added
- **No hard deletes, anywhere, in either mode**: audited every mutating
  endpoint. Two real hard deletes were found and converted to soft state
  changes that preserve history — removing a team member now sets
  `User.status = SUSPENDED` (revokes access, keeps the record) instead of
  `db.delete()`; deactivating a webhook endpoint now sets `is_active = False`
  instead of deleting it (and its delivery log). Every other "delete" route
  already soft-deactivated (payment links, products, API keys, sessions).
- **Audit log**: `AuditLogEntry` (tenant-scoped, append-only, indexed on
  `(merchant_id, created_at)`) records data changes made by team
  members/owners, with actor identity threaded via a request-scoped
  contextvar (`core/audit_context.py`) set in `get_current_user`. Recorded
  explicitly at each mutation site (matching this codebase's existing
  explicit-call style for webhook events) rather than a global ORM hook —
  currently instrumented on team management (invite/role-change/remove),
  webhook endpoint create/deactivate, and API key create/revoke. Visible only
  to the merchant's Owner via `GET /api/v1/audit-log`. Broader endpoint
  coverage is incremental.
- **Platform super admin**: `PlatformAdmin` — a new, entirely separate
  identity from any merchant's `User`/`Owner`, living in the shared `public`
  schema, not reachable via any HTTP signup (provisioned only via
  `scripts/create_platform_admin.py`, which also handles 2FA enrollment
  directly since login has no path to enable 2FA after the fact). Login
  requires TOTP (mandatory, unlike merchant users' optional 2FA) and issues a
  distinctly-typed JWT (`platform_admin_access`) that merchant-scoped
  endpoints can never accept and vice versa.
- **Archive DB**: a fully separate Postgres instance (`docker-compose.yml`'s
  new `archive-db` service, `Settings.archive_database_url`) — the one
  sanctioned way live data ever leaves the main database. A platform admin
  must supply a second secret, the archive passphrase (`/me/archive-passphrase`),
  separate from their login password, before `POST /platform-admin/archive`
  will do anything — a step-up confirmation so a hijacked login session alone
  can never trigger it. `app/services/archive_engine.py` moves one merchant's
  `production`-schema rows into the archive DB table by table in FK-safe
  order; the merchant's own identity row (and team `users`) are *copied*
  (never removed) into the archive DB first so its mirrored schema's foreign
  keys resolve — the merchant's account keeps existing live, only its bulky
  transactional history moves. Verified live end-to-end against a disposable
  test merchant with synthetic data (never against real demo data): rows
  correctly disappeared from `production` and appeared in the archive DB,
  merchant identity survived in both places, wrong-passphrase and
  passphrase-not-set-yet cases correctly rejected with 401/409.

### Phase 4 — Notifications, email, session security, disputes, platform status

#### Added
- **Notifications**: `app/models/notification.py`, `services/notifications.py`,
  `api/v1/notifications.py`. Every audited data change (`services/audit_log.py`)
  now surfaces in the merchant's notification feed automatically, plus
  purpose-built notifications for sign-in from a new device, password
  change/reset, session revocation, payment succeeded/failed, refunds,
  disputes, and payouts. Per-category email opt-in, with a second delivery
  address that only activates once its own emailed code is redeemed. Dashboard:
  a bell panel in the top bar, a full `/dashboard/notifications` feed with
  filters, and a detail page per notification.
- **Email verification, emailed OTP, password reset**: `services/email.py`
  (stdlib SMTP, console-mode when unconfigured — no mail server needed for
  local dev), `services/verification.py` (HMAC-digested one-time codes,
  single-use, attempt-capped). New account emails are unverified but usable;
  verification gates live-mode eligibility. Full reset flow
  (`/auth/password-reset`, `/confirm`) shipped with a UI
  (`ForgotPassword.jsx`) — it existed on the backend with no frontend before
  this phase.
- **Session hardening**: sessions are now bound to a device (`X-Device-Id`,
  client-generated, non-secret, read only after auth), not to each login —
  signing in again from an already-signed-in browser continues that session
  instead of adding a row. Refresh tokens carry a `sid` claim; a rotated
  token being replayed is treated as theft (the whole session is revoked, a
  critical notification fires), not as an ordinary expiry — the same pattern
  major identity providers use. `POST /users/me/sessions/revoke-others`
  added. Verified: 3 logins from one device → 1 session row; token-reuse
  replay → 401 and the session dies.
- **Disputes**: `api/v1/disputes.py` — the model existed with zero endpoints
  before this phase. List/detail/respond, plus a sandbox-only
  `POST /disputes/simulate` (no real card network exists in sandbox to raise
  a real one) that raises a test dispute against an eligible succeeded
  charge, notifies the merchant, and starts a 7-day response clock. Dashboard
  pages replace the `ComingSoon` stub.
- **Platform status monitoring**: `services/status_monitor.py` +
  `api/v1/status.py`. Global, super-admin-owned (not merchant-configurable) —
  11 checks probed every 60s, 10s once failing, emailing
  `silicatelabs@gmail.com` on first failure and at most every 10 minutes
  while still down, plus a recovery email. Public `website/status.html`
  exposes capability names and uptime only — never the probed path, method,
  or error text.
- Deployed: `ppay.silicatelabs.site` (marketing site) and
  `app.ppay.silicatelabs.site` (dashboard + API) on a dedicated GCP VM,
  TLS via Let's Encrypt, systemd-managed `uvicorn`, Postgres 16.

### Phase 5 — Seven production-readiness gaps, closed for real

Each item below was built, then verified against a running system before being
called done — not just written and assumed correct. Migration IDs are given so
any of this can be traced back to an exact schema change.

#### Payments Analytics (`GET /api/v1/dashboard/payments-analytics`)

- New: `app/schemas/payments_analytics.py` (`PaymentsAnalyticsResponse`,
  `RatePoint`, `MethodBreakdownItem`, `PeriodComparison`), new function
  `get_payments_analytics` in `app/services/analytics.py`, new endpoint in
  `app/api/v1/settlements.py`.
- Deeper cuts of the same `Transaction` rows Overview's snapshot already
  reads — no new data source: daily success-rate/AOV/refund-rate trends,
  a payment-method breakdown, an hourly activity histogram, and
  period-over-period comparisons (current window vs. the immediately
  preceding window of equal length).
- Deliberately returns `null`, not a fabricated `0`, for any day or period
  with no transactions to compute a rate from — a 0% success rate and "no
  data" are different claims, and `RatePoint`/`PeriodComparison` both carry
  that distinction into the JSON.
- Frontend: `frontend/src/pages/Analytics.jsx`, reusing the existing
  `TrendChart` component. Nav: `Payments Analytics` (Shortcuts) and
  `Analytics` (Products › Payments) now route to `/dashboard/analytics`
  instead of the `ComingSoon` stub.
- Verified: real sandbox transactions produced correct trend points, method
  breakdown percentages, and `null`-vs-`0` behavior on empty days, checked
  against the raw API response before the frontend was built.

#### Tax (`/api/v1/merchants/me/tax`, `/api/v1/merchants/me/tax/summary`)

- Migration `e2b74a6d1c90`: adds `national_tax_number`,
  `sales_tax_registration_number`, `tax_filer_status` (enum:
  `UNKNOWN`/`FILER`/`NON_FILER`), `tax_province` (enum: the five
  provinces/territories with their own Sales-Tax-on-Services authority) to
  `merchants`.
- New: `app/services/tax_calculator.py`, `app/schemas/tax.py`,
  `app/api/v1/tax.py`.
- Computes two structurally different figures, kept separate on purpose:
  **Sales Tax on Services**, owed on PPay's own platform *fee* (Pakistan
  taxes services provincially — Punjab/PRA, Sindh/SRB, Khyber Pakhtunkhwa/KPRA,
  Balochistan/BRA, ICT/FBR — each rate is hardcoded with its issuing
  authority named in a comment, not asserted as always-current); and
  **estimated withholding tax exposure** on the merchant's own gross volume,
  by FBR filer/non-filer status. Both are computed at report time, not
  baked into the persisted per-transaction fee — deliberately not touching
  `services/fee_calculator.py`'s live money math.
- The report page states plainly it is an estimate, not filing advice, and
  that PPay does not file or remit anything on the merchant's behalf.
- Frontend: `frontend/src/pages/Tax.jsx` — a registration form (NTN/STRN/
  province/filer status) plus the report, both period-selectable. Nav:
  `Products › More › Tax` now routes to `/dashboard/tax`.
- Verified: `curl` against the live endpoint with `sales_tax_registration`
  unset (correctly returns `null` for the tax figures) and set to Sindh
  (13.00% correctly applied to the platform-fee total, independently of the
  withholding-tax figure computed off gross volume).

#### Financial Connections — payout bank verification (`/api/v1/merchants/me/financial-connections/*`)

- Migration `f4c8d02e6a13`: adds `payout_verified_at`,
  `payout_verification_amount_1`/`_2`, `payout_verification_attempts`,
  `payout_verification_sent_at` to `merchants`.
- New: `app/services/bank_verification.py`, `app/schemas/bank_verification.py`,
  `app/api/v1/financial_connections.py`.
- What "Financial Connections" actually means here — deliberately not a
  third-party bank-aggregator integration, since none broadly exists to
  integrate with for Pakistani banks: proving the merchant controls the
  payout bank account they entered, via the same micro-deposit mechanism
  Stripe/PayPal/GoCardless use for real ACH verification. Two random 1–99
  amounts are generated; in a live deployment they'd only become visible on
  the merchant's real bank statement after 1–2 business days (never
  revealed anywhere else); in sandbox mode (gated on `merchant.live_status`,
  not on deployment environment) they're included directly in the
  notification, the same "sandbox shows you what a real flow would make you
  wait for" pattern already used for OTP codes.
- 5 attempts max per verification; changing the payout account number (in
  the existing `PATCH /merchants/me/payout`) now calls `clear_verification`
  so a new, unproven account can't inherit an old verification.
- Frontend: `frontend/src/pages/FinancialConnections.jsx`. Nav and the
  Settings hub card both now route to `/dashboard/financial-connections`;
  the Settings card's description was corrected (it previously said "link
  and verify *customer* bank accounts," which is not what this is).
- Verified end-to-end in a real browser session: started verification, read
  the two amounts back out of the notification API, submitted them through
  the actual form fields (not just the API), got "Bank account verified,"
  then changed the bank account number and confirmed the status reset to
  Unverified.

#### Rate limiting (`app/core/rate_limit.py`, `app/core/middleware.py`)

- In-process sliding-window counters, four tiers checked in priority order:
  auth-sensitive paths (login/register/password-reset/etc., 10/min, keyed by
  IP — the actual credential-stuffing surface), API keys (120/min, keyed by
  a SHA-256 hash of the key, never the raw secret), signed-in dashboard
  sessions (300/min, keyed by a hash of the JWT), and a general per-IP
  fallback (60/min) for public checkout pages. `/health`, `/health/db`, and
  docs endpoints are exempt; loopback (`127.0.0.1`/`::1`) is exempt so the
  status monitor's own probes can never trip their own limiter and read as
  a false outage.
- `RateLimitMiddleware` is registered *before* `CORSMiddleware` in
  `main.py` — Starlette wraps in reverse of registration order, so this
  makes CORS the outermost layer and a 429 response still carries proper
  CORS headers, rather than surfacing to the browser as an opaque CORS
  failure that hides the real error.
- A `sweep_idle_counters` APScheduler job runs every 10 minutes so memory
  doesn't grow unbounded across every distinct caller the process has ever
  seen.
- Explicitly scoped as in-process, single-worker state — the module
  docstring says exactly what would need to change (Redis-backed counters)
  before this is correct under more than one `uvicorn` worker or instance.
- Verified: a Python-level unit test proved all four tiers trip at their
  configured limits; an `httpx.ASGITransport` test proved a 429 carries the
  right `Retry-After` header and CORS headers; then, against **live
  production through nginx**, 12 real login attempts from one IP produced
  10× `401` followed by 2× `429` — the actual deployed path, not just the
  code path.

#### Secrets management (`app/core/secrets_check.py`)

- GCP Secret Manager was evaluated and ruled out for this session: the
  VM's service account only carries `devstorage.read_only` /
  `logging.write` / `monitoring.write` / etc. scopes, not `cloud-platform`
  — reaching Secret Manager needs that broadened, which requires stopping
  and restarting a **live production** VM, a deliberate operator decision
  this session declined to make silently.
- What was built instead, at zero infrastructure cost: `enforce_secrets_check`,
  called once in `main.py`'s lifespan, **refuses to start the process** in
  `ENVIRONMENT=production` if `JWT_SECRET_KEY` is still the
  `.env.example` placeholder or shorter than 32 characters, or if
  `DATABASE_URL` still contains the default local-dev credentials
  (`openpay:openpay@` / `ppay:ppay@`). A production deployment with
  `SMTP_HOST` unset (outbound email silently in console mode) logs a
  warning but doesn't block startup, since that's an operational gap, not a
  security one.
- A codebase-wide grep for hardcoded secret-shaped string literals came back
  clean.
- Verified with four direct unit-level cases (default JWT in production →
  raises; default DB creds in production → raises; good config in
  production → boots silently; default JWT in development → warns, boots
  anyway) and then against the real production `.env`, where the only
  finding was the already-known SMTP gap, logged as a warning, and the
  service started normally.

#### Disaster recovery (`backend/scripts/backup_database.sh`, `RESTORE.md`)

- Nightly `pg_dump` (all three schemas: `public`, `sandbox`, `production`),
  gzip-compressed, 14-day local retention, installed via
  `/etc/cron.d/ppay-backup` at 03:15 server time.
- First version used `pg_dump --single-transaction`, which doesn't exist —
  that flag belongs to `psql`/`pg_restore`, not `pg_dump` — and the script's
  own zero-byte-output guard caught it immediately on the first real run.
  Fixed and re-verified before being treated as done.
- Actually restore-tested, not just documented as restorable: dumped the
  live database, restored it into a disposable `ppay_restore_test`
  database, and diff'd both `pg_stat_user_tables` row-count estimates *and*
  real `SELECT count(*)` on five specific tables (`sandbox.notifications`,
  `sandbox.transactions`, `sandbox.disputes`, `public.users`,
  `public.merchants`) against the source — exact match on every one, restore
  completed in under a minute.
- A copy of one real backup was pulled off the VM to `db-backups/` (git-
  ignored) to exercise the documented off-site procedure, not just describe
  it. No automated off-site copy yet — the VM's storage scope is read-only,
  same constraint as the Secret Manager decision above — documented as the
  next step in `RESTORE.md` and `GO_TO_MARKET.md`.
- RPO ≈24h (the gap between backups), RTO <2 min for the database itself,
  both stated in `RESTORE.md` alongside the exact restore commands.

#### Fraud engine — Sentinel, partially live (`app/services/fraud_engine.py`)

- Migration `a7f3e91c4d02`: adds `buyer_ip` to `checkout_sessions` (nothing
  captured this before), `risk_score` and `risk_flags` to `transactions`.
- Rule-based signals computed from data that actually exists in this system
  — not the ML/device-fingerprinting/custom-rule-builder vision the
  Sentinel marketing page described before this phase: velocity (≥4 attempts
  from the same email, or ≥6 from the same IP, in a 10-minute window),
  first-time-customer status, amount deviation (>5× this specific
  merchant's own trailing average — "high" is relative to what that
  business normally charges, not a fixed rupee figure), and recent declines
  (≥3 failures from the same identity in 30 minutes — the card-testing
  pattern).
- Wired into `api/v1/checkout.py`'s pay endpoint *before* any
  `sandbox_engine.authorize_*` call: a score ≥75 is blocked with
  `failure_reason="blocked_by_fraud_rule"` and an `AuthorizationResult`
  constructed directly, without the rail ever being touched — matching the
  Sentinel page's "a blocked attempt never touches the rail" promise for
  the first time.
- `pages/Sentinel.jsx` rewritten to say exactly this: a "Live now" section
  (risk scoring, block rules) and an "On the roadmap" section (custom rule
  builder, true device fingerprinting beyond IP, automatic dispute-evidence
  assembly), instead of the whole page previously reading "not live yet."
  Transaction detail pages now show a risk-score card with the flags that
  fired when `risk_score > 0`.
- Verified with an engineered scenario, not a synthetic unit test: 4 rapid
  declined attempts from one email built up velocity and decline signals,
  then a 5th attempt using a **valid succeeding test card number**
  (`4242424242424242`) at 500,000 PKR was blocked with `risk_score: 100`
  and all five flags — confirmed by the returned `gateway_reference` being
  empty, which only happens if the sandbox rail was genuinely never called.
  Re-verified identically against live production.

#### KYC / Go-Live review (`api/v1/platform_admin.py`)

The most significant fix in this phase: **nothing anywhere in the codebase
could previously move a `LiveAccessRequest` to approved or rejected, or a
merchant's `live_status` to `LIVE`.** The Go-Live form collected full KYC
data (business details, representative CNIC/DOB, bank account) into a
request that could sit in `pending_review` forever with no code path to ever
resolve it — found by grepping for every write of `MerchantLiveStatus.LIVE`
across the codebase and finding none.

- Migration `b1d84f2a6c33`: adds `rejection_reason` to
  `live_access_requests`.
- New endpoints: `GET /platform-admin/live-access-requests` (list, filterable
  by status), `GET .../{id}`, `POST .../{id}/approve`, `POST .../{id}/reject`
  (with a required reason). Approve sets `merchant.live_status = LIVE` and
  the request to `APPROVED`; reject sets `live_status` back to
  `SANDBOX_ONLY` (not `PENDING_REVIEW` — that would mean "still being
  looked at," which is no longer true) and stores the reason. Both notify
  the merchant (`services/notifications.py`) with the outcome.
- Second bug fixed in the same pass: `submit_go_live_request` upserted a
  resubmission's field values but never reset the request's own `status`,
  `reviewed_at`, or `rejection_reason` — a merchant who fixed their
  application and resubmitted after a rejection would have kept reading as
  permanently rejected. Now explicitly reset on every resubmission.
- Frontend: `pages/GoLive.jsx` now shows the rejection reason inline and a
  new "Update and resubmit" button that pre-fills the multi-step form from
  the rejected request's own data (so a merchant isn't retyping a CNIC and
  bank account that were never the problem) rather than leaving them stuck
  on a dead-end status screen with no way forward.
- Verified end-to-end with a real platform-admin account (provisioned via
  the existing `scripts/create_platform_admin.py`, TOTP included) against
  the local backend: submit → list as pending → reject with a reason →
  merchant's `live_status` correctly reverts to `sandbox_only` and the
  reason is visible → resubmit correctly re-enters `pending_review` with
  the reason cleared → a second test account submit → approve →
  `live_status` becomes `live` and the notification fires → a repeat
  approve attempt on the same request correctly 409s. Screenshotted in a
  real browser: the rejected state, the reason banner, and the resubmit
  button opening a form pre-filled with the original submission.

#### Also in this phase

- `RESTORE.md` (root) documents the full backup/restore procedure described
  above; `ntfy1-backup-2026-09-07/RESTORE.md` (outside the repo, on the
  local machine only) documents the full pre-wipe backup of the two
  services (`ntfy.autruckers.com`, `xlabs.silicatelabs.site`) that
  previously lived on the `ntfy1` VM before it was repurposed to host PPay.
- `GO_TO_MARKET.md`'s engineering-gaps table updated for every row this
  phase touched (Notifications, Disputes, Monitoring & alerting, Rate
  limiting, Disaster recovery) so it no longer claims something is unbuilt
  once it isn't.
- Sidebar depth/hierarchy redesign (`DashboardLayout.jsx`): section →
  group → item now reads as indent-once-then-hold, with a third level
  distinguished by opacity rather than a second indent step; collapsed
  icon-rail spacing tightened; Help & Support added to the account popup
  menu.
- Auth screens (`Login`/`Register`/`VerifyEmail`/`ForgotPassword`) rebuilt
  as a split-screen layout (`AuthLayout.jsx` + `AuthShowcase.jsx`) — real
  shipped-feature copy and an honest empty-state dashboard preview on the
  right, no fabricated revenue figures. A working forgot-password flow was
  added to the frontend for the first time (the backend endpoints already
  existed with no UI reachable from them). An orphaned, never-wired
  `AuthCarousel.jsx` that imported a nonexistent CSS file was deleted.

## v2

### Added
- **Team accounts**: a `User` model separate from `Merchant` — multiple logins per business, each with a role (`owner`, `admin`, `analyst`, `support`). Includes invite-by-email flow, accept-invite page, role changes, member removal, and protection against removing/demoting the last owner.
- **Payment Links**: create reusable, shareable payment links from the dashboard; public pay page; per-link detail view with its transaction history.
- **Billing (Invoices)**: send one-off, customer-directed invoices with an optional due date; public pay page; cancel unpaid invoices; per-invoice detail view linking to its transaction.
- **Customers**: a directory built automatically from payment history (no manual entry), with total spend, transaction count, and a per-customer detail view (transactions + invoices).
- **Refunds**: full refund on succeeded, unsettled transactions, exposed in the Transactions table; fires a `charge.refunded` webhook.
- **Go Live flow**: merchants submit business and settlement bank details for review; adds a `live_status` field (`sandbox_only` / `pending_review` / `live`) to the merchant record. There is intentionally no code path that auto-approves this — it models the real manual KYC/compliance review every licensed payment gateway requires before real money moves.
- **Help Center** page: FAQs, sandbox test card/wallet reference, a quick-start API snippet, contact info, and an honest "on the roadmap" list of what isn't built yet (POS hardware, e-commerce plugins, recurring billing, real settlement).
- **Theme toggle**: light/dark/system, persisted across sessions, with a pre-paint init script so there's no flash of the wrong theme on load.
- **Dashboard redesign**: grouped icon sidebar, Stripe-inspired color and typography tokens, and a 14-day volume chart on the Overview page.
- Merchant business profile fields (support email/phone, address, website, statement descriptor), branding fields (logo URL, brand color), and payout settings (bank name/account, payout schedule).
- `backend/scripts/seed_demo.py` — populates a merchant with realistic transactions, invoices, payment links, refunds, and settlements for demos.
- Project `README.md`.
- Brand renamed from "OpenPay" to "PPay" throughout the app.

### Changed
- **Auth model split**: `Merchant` is now the business entity; `User` is who logs in and acts on its behalf. Register/login/refresh operate on `User`; `Merchant` no longer stores a password.
- Refund, webhook, and API key management endpoints now enforce role-based permissions (owner/admin, or owner/admin/support for refunds).
- `checkout_sessions` gained a `payment_link_id` column linking a session back to the payment link that created it.

### Database
- `8a4c78556c99` — add `users` table (team accounts) and merchant business/branding/payout fields
- `75a7e4a02514` — add invoices, live access requests, merchant `live_status`
- `87f19387c2cf` — add `REFUNDED` value to the transaction status enum
- `a8b28c4812c0` — add `payment_link_id` to `checkout_sessions`

## v1

Initial sandbox MVP.

### Added
- FastAPI backend: merchant auth (JWT), sandbox API key issuance, checkout sessions (idempotent) with a deterministic sandbox payment simulation engine (magic test cards/wallets), transactions, HMAC-signed webhooks with retry backoff, simulated nightly settlement batching, and a fee calculator.
- React (JS/Vite) frontend: login/register, dashboard overview, transactions list, API key management, webhook endpoint management, settlements, and the hosted checkout page customers land on to pay.
- PostgreSQL via Docker Compose, Alembic migrations, initial schema.
