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
