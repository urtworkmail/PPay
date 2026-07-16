# PPay

A PayFast-style payment gateway for Pakistan — merchant onboarding, hosted checkout, payment links, invoicing, refunds, webhooks, and settlements. This is a **sandbox-mode** build: all payment authorization is simulated (see `TEST_CARDS.md`), meant to demo the product end-to-end before pursuing real licensing (see "Going live" below).

## Stack

- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL + Alembic
- **Frontend**: React (plain JS, Vite) + React Router
- **Local infra**: Docker Compose (Postgres only)

## Running locally

### 1. Database

```bash
docker compose up -d db
```

Postgres runs on `localhost:5433` (not 5432, to avoid clashing with a locally installed Postgres).

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash; use .venv/bin/activate on macOS/Linux
pip install -e ".[dev]"
cp ../.env.example ../.env       # first time only
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs at `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App at `http://localhost:5173`.

## What's built

- Merchant signup/login (JWT) + sandbox API key issuance
- Checkout Sessions API (idempotent) + hosted checkout page
- Payment Links (shareable, reusable) and Billing/Invoices (one-off, customer-directed)
- Sandbox payment simulation engine — deterministic test cards/wallets, see `TEST_CARDS.md`
- Refunds (full refund on unsettled succeeded transactions)
- Webhooks — HMAC-signed delivery with retry backoff
- Simulated nightly settlement batching
- Customers view (derived from payment history)
- Dashboard: volume chart, success rate, fees, transactions, settlements
- **Go Live flow**: merchants submit business/bank details for manual review — there is deliberately no code path that auto-approves real-money processing
- Light/dark/system theme toggle
- Help Center with FAQs, test values, and a quick-start API snippet

## Going live (Phase 2)

This app intentionally does not process real money. Real payment processing requires, at minimum:

- An SBP Payment System Operator/Payment Service Provider license, or a partnership with an already-licensed PSP/bank
- An acquiring/settlement bank relationship (1LINK/RAAST rails)
- Card network arrangements (Visa/Mastercard), typically via the acquiring bank
- JazzCash/Easypaisa wallet aggregator agreements
- PCI-DSS compliance or a compliant tokenization vendor
- Merchant KYC/AML program
- Fraud/risk tooling, security audit, and legal agreements (ToS, merchant contracts, dispute policy)

Realistic timeline: the sandbox build here is weeks of engineering; going live is typically 6–24 months of regulatory/business work depending on whether you pursue a direct SBP license or partner with an existing licensed PSP.

## Not built (out of scope for this sandbox)

- Physical POS card readers (hardware-dependent)
- E-commerce plugins (WooCommerce/Shopify/Magento)
- Recurring/subscription billing cycles
- Real bank/card network/wallet settlement
