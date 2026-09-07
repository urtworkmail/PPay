# PPay

Payment infrastructure for Pakistan — one API and one dashboard for checkout, payment links, invoicing, subscriptions, fraud scoring, disputes, tax, and settlements. A product of **Silicate Labs**.

This is a **sandbox-mode** build: every payment, wallet, and settlement is a deterministic simulation (see `backend/TEST_CARDS.md`). No real money moves yet — PPay does not hold a PSO/PSP or EMI licence and does not custody funds. See the [Roadmap](website/roadmap.html) for exactly what's shipped, what's in progress, and what hasn't started.

**Marketing site:** [`website/`](website) (static HTML, no build step) · **Dashboard app:** [`frontend/`](frontend) (React + Vite) · **API:** [`backend/`](backend) (FastAPI)

## Stack

- **Backend**: FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL 16 + Alembic — schema-separated `sandbox` / `production` data via `schema_translate_map`
- **Frontend**: React (Vite, plain JS) + React Router
- **Website**: static HTML/CSS/vanilla JS, no framework, no build step
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

### 3. Dashboard

```bash
cd frontend
npm install
npm run dev
```

App at `http://localhost:5173`.

### 4. Marketing website

```bash
cd website
python -m http.server 8080
```

Static site at `http://localhost:8080` — no build step, no dependencies.

## What's built

- **Merchant accounts** — signup/login (JWT), sandbox + live API keys, roles (Owner/Admin/Analyst/Support), TOTP two-factor auth, per-device session control
- **Checkout** — idempotent Checkout Sessions API + a hosted, branded payment page (card, wallet, bank transfer)
- **Payment Links** — shareable, reusable payment URLs built from a Product's Price
- **Invoicing** — auto-numbered, one-off invoices with a hosted pay link
- **Subscriptions** — recurring billing on saved payment methods, with a 3-attempt dunning retry schedule on failed renewals
- **Sentinel** — six deterministic fraud signals scored on every checkout attempt; a 75+ score blocks the attempt before any rail is called
- **Disputes** — chargeback response flow with a 7-day deadline, plus a sandbox-only `/disputes/simulate` endpoint to rehearse it
- **Tax** — Pakistan provincial Sales Tax on Services estimates (Punjab/PRA, Sindh/SRB, KPRA, BRA, ICT/FBR) on PPay's own fee
- **Financial Connections** — micro-deposit verification that a merchant controls their payout bank account
- **Balances & Payouts** — itemised nightly settlement batches, released on a daily/weekly/monthly schedule
- **Analytics** — daily trends, per-payment-method success rates, an hourly histogram, period-over-period comparisons
- **Events, webhooks & notifications** — an immutable event log (`Event`), HMAC-signed webhook delivery with retry backoff, and a categorised in-dashboard notification feed with per-category email control
- **Platform status monitor** — live uptime tracking per capability, shown at `status.html`
- **Audit log** — every account-affecting action recorded, immutably
- **Go-Live review** — merchants submit business/bank details for manual review before any live-mode access; there is deliberately no code path that auto-approves real-money processing

## Not built yet

See the full [Roadmap](website/roadmap.html) page for the up-to-date, honest list. Headlines:

- Real money movement of any kind — every transaction today is a sandbox construct
- The licensed banking/PSP partnership that will custody funds
- Sentinel custom rule builder and device fingerprinting (today's signals use IP only)
- Physical POS / card-present payments
- Marketplaces / split payments across multiple recipients
- A mobile dashboard (desktop-only today)

## Team

Built by **Usama Rehman Tarar** and **Muhammad Junaid**, under **Silicate Labs**. See the [Team page](website/team.html) for more.
