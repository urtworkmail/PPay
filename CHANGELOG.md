# Changelog

All notable changes to PPay are logged here, one entry per pushed version.

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
