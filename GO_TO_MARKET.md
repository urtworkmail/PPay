# OpenPay (PPay) — Go-to-Market Plan

**Status:** Sandbox-complete. Everything in this document is what's needed to move from "a fully working sandbox payment gateway" to "a licensed entity processing real money in Pakistan." This is a planning aid, not legal advice — regulatory stage names, thresholds, and forms should be verified against current State Bank of Pakistan (SBP) publications and with a licensed corporate/fintech lawyer before you act on anything here. Regulations change; this reflects the framework as generally understood, not a live legal opinion.

---

## 1. Corporate & regulatory path

### 1.1 Incorporate

Register a private limited company with the **Securities and Exchange Commission of Pakistan (SECP)**. A payment gateway/PSP license applicant is expected to be a Pakistani-incorporated company with a defined minimum paid-up capital (see below) — incorporate before or alongside the SBP application, since SBP will ask for the company's incorporation documents.

### 1.2 Choose the SBP authorization track

SBP regulates this space under the **Payment Systems and Electronic Fund Transfers Act, 2007 (PSEFTA)**. Two licensing frameworks are the relevant candidates for a product shaped like this one:

| Track | What it covers | Fits us because |
|---|---|---|
| **PSO/PSP** (Payment System Operator / Payment Service Provider) — under SBP's *Regulations for Payment System Operators and Payment Service Providers* | Operating a payment gateway, aggregation, merchant acquiring/switching services — moving money between existing bank accounts/instruments without issuing your own stored-value product. | This is what OpenPay actually does: authorize a card/wallet/bank-transfer payment and settle it to a merchant's existing bank account. No stored-value product is issued to end users. |
| **EMI** (Electronic Money Institution) — under SBP's *Electronic Money Institutions Regulations, 2019* | Issuing your own stored-value/wallet product (an e-money account users top up and hold a balance in). | Only relevant if the roadmap adds a wallet/stored-value feature. Not needed for the gateway-only model described here. |

**Recommendation: pursue the PSO/PSP track.** It matches the product as built — a checkout/gateway layer over existing rails, not a new money-issuance product.

Indicative capital requirement for a PSO/PSP is in the range of **PKR 200 million minimum paid-up capital** (SBP has adjusted figures over time and sometimes differentiates by scope — confirm the current figure directly from SBP's published regulations before budgeting).

### 1.3 SBP approval stages (typical shape)

1. **In-principle approval (IPA)** — submit the business plan, ownership/fit-and-proper disclosures for directors and major shareholders, technology and security architecture, AML/CFT policy, and the capital commitment. SBP reviews and issues an in-principle approval if satisfied.
2. **Pilot / sandbox launch** — SBP may require operating in a controlled pilot (limited transaction volume/value, limited merchant set) under supervision before full launch. This is a natural continuation of the product's existing "sandbox-first" philosophy — the pilot is effectively supervised live traffic at small scale.
3. **Final license** — after a satisfactory pilot and full compliance review (systems audit, security assessment, AML program review), SBP issues the full PSO/PSP license.

Build in **12–24 months** for this sequence end to end; it is rarely fast, and depends heavily on SBP's queue and how complete the application package is on first submission.

---

## 2. Banking & network partnerships

None of these can be self-served — each requires a commercial agreement with an existing licensed entity:

- **Settlement/sponsor bank.** A commercial bank that holds the pooled settlement account, through which merchant payouts actually move. Needed before you can settle a single real transaction.
- **Acquiring relationship for card rails.** Either (a) a direct principal membership with Visa/Mastercard (very high bar, generally only for banks), or (b) — far more realistic at this stage — an **acquiring bank sponsorship**, where a licensed acquiring bank processes card transactions on your behalf and you integrate against their gateway/API. This is how most PSPs actually operate.
- **1LINK integration.** 1LINK operates Pakistan's domestic interbank switch and the **Raast** instant payment rail. A PSO/PSP typically connects here for domestic debit-card processing and Raast-based bank transfers — this is likely your primary domestic rail, cheaper and faster to integrate than international card schemes.
- **Wallet integrations.** Direct API partnerships with JazzCash and Easypaisa (Pakistan's two dominant mobile wallets) — each has its own merchant-onboarding and technical-integration process, separate from the bank/card rails above.

None of these can begin in earnest until incorporation is complete and (for most of them) SBP in-principle approval is in hand — banks and 1LINK will ask for it before signing.

---

## 3. Compliance program

- **PCI-DSS.** Once real card data is involved, PCI-DSS applies (likely Level 1 given aggregator/gateway status — assessed by transaction volume). The current sandbox design **never handles real PAN data by construction** (`sandbox_engine.py`'s own docstring states this explicitly) — that was a deliberate choice to keep the build honest about what it is. Going live means either (a) fully hosted/tokenized card fields from your acquirer so raw card data never touches OpenPay's servers, or (b) a full PCI-DSS Level 1 assessment if you handle raw PANs at any point. Option (a) is dramatically cheaper and faster — strongly recommended.
- **AML/CFT.** SBP + FATF-aligned obligations: merchant KYC/CDD (know-your-customer, customer due diligence), ongoing transaction monitoring, suspicious-transaction reporting, sanctions screening. The existing **Go-Live wizard already collects the KYC data skeleton** (business type, legal name, NTN, representative CNIC/DOB/address, bank details — see `backend/app/models/live_access_request.py`) — this needs to grow into a real verification pipeline (see §4) rather than a form that's stored and manually reviewed.
- **Data protection & localization.** Pakistan's data protection framework is still evolving; SBP separately requires payment-system data to be processed/stored within Pakistan for regulated entities. Plan infrastructure accordingly — this affects hosting choices.
- **Statutory audits & periodic reviews.** Annual financial audit, periodic SBP compliance reporting, and independent security assessments will be ongoing licensing conditions, not one-time gates.
- **Penetration testing / VAPT.** Expect SBP to require an independent security assessment (VAPT) before final licensing, and likely annually afterward.

---

## 4. Engineering gaps to production (mapped to what exists today)

| Gap | Current state | What changes |
|---|---|---|
| Real payment authorization | `sandbox_engine.py` — deterministic, fully simulated | Replace with real acquirer/wallet adapters behind the same `AuthorizationResult` interface (`success`, `failure_reason`, `gateway_reference`, `masked_details`) — the interface was deliberately kept minimal and adapter-shaped so this swap doesn't require touching the checkout/subscription pipeline above it. |
| Merchant KYC | Go-Live wizard stores a `LiveAccessRequest` for manual review | Add a real KYC/business-verification vendor integration (document upload/OCR, CNIC verification, sanctions/PEP screening) feeding into the same review queue. |
| Real card data handling | Never accepted — sandbox only takes magic test digits | Integrate hosted/tokenized fields from your acquirer (see §3) so raw PANs never reach OpenPay's servers. |
| Notifications | In-app feed + transactional email now built (`services/notifications.py`, `services/email.py`) — covers new-device sign-in, password change/reset, payments, refunds, disputes, payouts, and every audited data change. Still no SMS, and outbound mail needs a working `SMTP_HOST` configured before it leaves console mode in production. | Add SMS for dunning/payout confirmations if needed; provision a real SMTP host/credentials. |
| Secrets & key management | Standard env-var config | Production secrets manager (e.g. a KMS/vault), API-key hashing already uses bcrypt (`core/security.py`) which is fine to keep. |
| Rate limiting | Built (`core/rate_limit.py`): per-API-key, per-signed-in-session, per-IP, and a tight auth-endpoint tier for login/register/password-reset. State is in-process (single `uvicorn` worker today) — moving to multiple workers/instances requires swapping the in-memory counters for a Redis-backed store, or each instance enforces the limit independently. | Move to Redis-backed counters before running more than one worker/instance. |
| 3-D Secure | Not implemented — sandbox cards authorize directly | Required for real card-present-online compliance in most acquirer relationships; adds a redirect/challenge step to the checkout flow. |
| Reconciliation | `settlement_engine.py` simulates settlement/payout timing against no real bank | Real settlement requires reconciling against actual bank settlement files from your acquirer/1LINK — a genuinely new subsystem, not a tweak. |
| Monitoring & alerting | Uptime monitoring built: `services/status_monitor.py` probes 11 capabilities every 60s (10s while failing) and emails on failure/recovery, with a public status page. Still no error-rate or fraud-signal monitoring/alerting. | Add error-rate and fraud-signal monitoring/alerting before real money is at risk. |
| Disaster recovery | Automated nightly backups (`backend/scripts/backup_database.sh`, cron on the app server), 14-day retention, restore procedure tested end-to-end against a disposable database (exact row-count match — see `RESTORE.md`). RPO ~24h, RTO <2 min for the database itself. No automated off-site copy yet — the VM's service account has read-only Cloud Storage scope; pushing backups off-host needs that broadened (a VM restart) or a separate pull-based mechanism. | Broaden the VM's storage scope (or use a separate uploader) to get backups off the single host; consider more frequent snapshots if 24h RPO isn't tight enough. |
| Disputes/chargebacks | Read/respond lifecycle built (`api/v1/disputes.py`, `pages/Disputes.jsx`) — list, evidence submission, notifications. No real card network exists in sandbox to raise a genuine chargeback, so disputes are sandbox-simulated only; won/lost resolution and real network submission are not built. | Wire to the acquirer's real dispute/chargeback API once one exists; add won/lost resolution workflow. |
| Data retention policy | None formalized | Needed for both AML recordkeeping requirements and general data-protection hygiene. |

---

## 5. Sequenced roadmap

Regulatory and engineering tracks can run in parallel — the license timeline is the long pole, so don't gate engineering work behind it.

**Phase A (months 0–3) — parallel start**
- Incorporate with SECP.
- Engage a fintech-focused Pakistani law firm; begin the SBP PSO/PSP application package.
- Start acquiring-bank and 1LINK conversations (they'll want to see the in-principle application is underway).
- Engineering: PCI-safe hosted-fields integration design, secrets management, rate limiting — none of this depends on the license.

**Phase B (months 3–9)**
- Submit SBP in-principle approval application.
- Sign settlement bank + acquiring bank agreements (conditional on IPA).
- Engineering: real KYC vendor integration, notifications infrastructure, monitoring/alerting, VAPT #1.

**Phase C (months 9–15)**
- SBP pilot/sandbox supervised launch — small-scale real transactions.
- Engineering: reconciliation subsystem against real settlement files, disaster recovery runbook, 3-D Secure.

**Phase D (months 15–24)**
- Full SBP license.
- Engineering: disputes/chargebacks module, data retention policy formalized, PCI assessment (if not fully avoided via hosted fields).
- Commercial launch.

Total realistic timeline to first real transaction: **~18–24 months**, license-gated. The sandbox product itself is not the bottleneck — it's ready to demo to banks, investors, and regulators today.
