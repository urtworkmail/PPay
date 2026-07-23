# Pakistan Domestic Payments Platform — System Architecture Spec

**Purpose of this document:** This is the canonical architecture reference for building a Stripe-equivalent payments platform for the Pakistani domestic market. It exists to solve a specific problem: individual features (checkout, payment links, subscriptions, wallet integrations) were built in isolation and are not connected through a shared core. This spec defines the single data model, state machines, and service boundaries that every feature must be refactored to use.

**Audience:** This document is written to be handed to an AI coding agent (Claude Code) for implementation. Every section should be treated as a spec to build against, not just a description.

---

## 1. Architecture Principles

1. **Single orchestration core.** Checkout Pages, Payment Links, and Subscriptions are *presentation/entry-point wrappers*. None of them talk to payment rails directly — they all create and transition a `PaymentIntent`. If a feature is calling JazzCash/EasyPaisa/1Link directly instead of going through the PaymentIntent engine, that is the bug to fix.
2. **Everything is an event.** Every state transition on `PaymentIntent`, `Subscription`, `Invoice`, `Refund`, or `Dispute` emits an immutable event to the event bus. Nothing should update a merchant's view of the world through a synchronous return value alone — webhooks are the source of truth for merchant-side fulfillment.
3. **Rails are adapters, not integrations.** JazzCash, EasyPaisa, Raast, and card acquiring all implement one `IPaymentAdapter` interface. The orchestrator never has rail-specific branching logic in it — that logic lives inside each adapter.
4. **Money either moved or didn't — never assume.** Network timeouts against a bank/wallet are treated as *unknown*, not *failed*. This must be a distinct state, reconciled separately, never blindly retried.
5. **Test and Live are structurally isolated**, not flag-gated on shared tables.

---

## 2. Universal Entity & Data Model

All workflows must read/write through this shared schema. This expands the original model with the entities required for account-lifecycle parity (refunds, disputes, discounts) and environment isolation.

### 2.1 Entity Relationship Overview

```
Merchant
  └─< Customer
        └─< PaymentMethod (tokenized: Card/PayPak, JazzCash, EasyPaisa, Raast alias)
  └─< Product ─< Price
  └─< Coupon ─< Discount (applied to Subscription/Invoice/PaymentLink)
  └─< Subscription (Customer + Price + Discount)
        └─< Invoice
              └─ PaymentIntent
                    └─< Charge
                          └─< LedgerEntry
                          └─< Refund
                          └─< Dispute
  └─< PaymentLink (wraps Price or ad-hoc amount)
  └─< WebhookEndpoint
        └─< Event (delivery log)
```

### 2.2 Entity Definitions

| Entity | Key Fields | Notes |
|---|---|---|
| **Merchant** | `id`, `business_name`, `kyc_tier` (0/1/2), `kyc_status`, `cnic`, `ntn`, `secp_reg_no`, `settlement_iban`, `settlement_cycle` (T+1/T+2), `rolling_reserve_pct`, `pk_test`, `sk_test`, `pk_live`, `sk_live`, `webhook_secret` | Live keys stay `disabled` until `kyc_status = approved` |
| **Customer** | `id`, `merchant_id`, `name`, `phone` (E.164, `92...`), `email`, `cnic` (optional, for tax invoices) | |
| **PaymentMethod** | `id`, `customer_id`, `type` (`card`/`jazzcash`/`easypaisa`/`raast`), `token`, `last4` or `masked_wallet_number`, `mandate_id` (for recurring), `status` (`active`/`expired`/`revoked`) | Never store raw PAN or wallet MPIN |
| **Product** | `id`, `merchant_id`, `name`, `description` | |
| **Price** | `id`, `product_id`, `amount_paisa`, `currency` (fixed `PKR`), `billing_scheme` (`one_time`/`recurring`), `interval` (`week`/`month`/`year`), `interval_count` | |
| **Coupon** | `id`, `merchant_id`, `code`, `percent_off` or `amount_off_paisa`, `duration` (`once`/`repeating`/`forever`), `duration_in_cycles`, `max_redemptions`, `expires_at` | |
| **Discount** | `id`, `coupon_id`, `subscription_id` or `invoice_id` or `payment_link_id`, `applied_at` | Join entity — a coupon "redeemed" onto something |
| **Subscription** | `id`, `customer_id`, `price_id`, `discount_id` (nullable), `status`, `current_period_start`, `current_period_end`, `trial_end`, `cancel_at_period_end` (bool), `mandate_payment_method_id` | |
| **Invoice** | `id`, `subscription_id` (nullable — null for standalone invoices), `customer_id`, `amount_due_paisa`, `status` (`draft`/`open`/`paid`/`past_due`/`void`/`uncollectible`), `due_date`, `is_standalone` (bool) | Standalone invoices support ad-hoc freelancer/B2B billing not tied to a subscription |
| **PaymentIntent** | `id`, `amount_paisa`, `currency`, `status`, `customer_id` (nullable), `payment_method_id` (nullable), `source_type` (`checkout`/`payment_link`/`invoice`), `source_id`, `is_sandbox` (bool), `idempotency_key` | See state machine §5.1 |
| **Charge** | `id`, `payment_intent_id`, `adapter_name`, `rail_reference_id`, `attempt_number`, `status`, `raw_response_payload` | One `PaymentIntent` can have multiple `Charge` attempts |
| **Refund** | `id`, `charge_id`, `amount_paisa`, `reason`, `status` (`pending`/`succeeded`/`failed`), `rail_refund_reference` | See state machine §5.3 |
| **Dispute** | `id`, `charge_id`, `amount_paisa`, `reason`, `status` (`needs_response`/`under_review`/`won`/`lost`), `evidence_due_by`, `evidence_submitted_at` | Card-network disputes primarily; wallet chargebacks map here too |
| **LedgerEntry** | `id`, `charge_id` or `refund_id`, `entry_type` (`debit`/`credit`), `account` (`acquiring_settlement`/`merchant_payable`/`fee_revenue`/`tax_payable`/`reserve_holdback`), `amount_paisa` | Double-entry, immutable, append-only |
| **PaymentLink** | `id`, `merchant_id`, `price_id` or `ad_hoc_amount_paisa`, `slug`, `single_use` (bool), `custom_fields` (JSON), `discount_id` (nullable) | |
| **WebhookEndpoint** | `id`, `merchant_id`, `url`, `secret`, `enabled_events` (array), `status` (`active`/`disabled_circuit_broken`) | |
| **Event** | `id`, `type`, `livemode` (bool), `payload` (JSON), `delivery_status`, `delivery_attempts`, `next_retry_at` | Immutable audit log + retry queue |
| **ReconciliationRecord** | `id`, `payment_intent_id`, `provider_statement_ref`, `provider_reported_status`, `platform_status`, `mismatch` (bool), `resolved_at` | New — see §6 |

---

## 3. Environment Isolation (Test vs Live)

**Decision: separate schemas, not a boolean flag on shared tables.**

- Two Postgres schemas: `sandbox` and `production`, both under the same database (or separate databases if scale demands it later).
- API Gateway middleware inspects the key prefix (`sk_test_...` vs `sk_live_...`) and sets the Postgres `search_path` (or routes to a separate connection pool) for the entire request lifecycle. This must happen once, at the top of the request, not be re-checked per query.
- Sandbox schema's `IPaymentAdapter` implementations are swapped for `MockJazzCashAdapter`, `MockEasyPaisaAdapter`, etc. — same interface, no rail-specific branching anywhere else in the code.
- Reasoning: a missed `WHERE is_sandbox = false` clause on a shared table is a silent, catastrophic bug class (test data mixing into the live ledger). Schema-level separation makes that class of bug structurally impossible instead of relying on discipline.

### Sandbox Simulator Behavior
| Test Input | Simulated Result |
|---|---|
| Card `4242 4242 4242 4242` | Instant success |
| Card `4000 0000 0000 0002` | 3DS challenge failure |
| Card `4000 0000 0000 0051` | Insufficient funds decline |
| Wallet number `03000000000` | USSD push → auto-approve after 3s |
| Wallet number `03000000001` | USSD push → timeout (tests the ambiguous state, §5.1) |
| Wallet number `03000000002` | USSD push → explicit decline |
| Raast alias `test-merchant@raast` | Auto-returns mock E2EID + success |
| Test Clock advance | Fast-forwards `current_period_end` on subscriptions to trigger renewal/dunning without waiting real time |

---

## 4. Core Workflows

### 4.1 Hosted Checkout
1. Merchant backend → `POST /v1/checkout/sessions` with line items, `success_url`, `cancel_url`, allowed methods.
2. Gateway authenticates via key prefix, creates `PaymentIntent` in `requires_payment_method`, returns hosted URL.
3. Buyer redirected to hosted page, selects method (Card / JazzCash / EasyPaisa / Raast).
4. Adapter executes rail-specific flow (USSD MPIN prompt, 3DS OTP, or Raast QR scan+approve).
5. Adapter reports result → `Charge` created → `PaymentIntent` transitions.
6. Event fires (`payment_intent.succeeded` / `.payment_failed`) → signed webhook to merchant → buyer redirected to `success_url`.
7. **Merchant fulfills the order only on the webhook, never on the redirect.**

### 4.2 Payment Links (No-Code)
1. Merchant creates a `Price` (or ad-hoc amount) + `PaymentLink` from the dashboard, gets a shareable slug URL.
2. Shared via WhatsApp/Instagram/SMS.
3. Buyer opens link → mobile-optimized hosted page → enters contact info + custom fields → selects method.
4. Same `PaymentIntent` engine as Checkout underneath — a `PaymentLink` is only a template that pre-fills session creation.
5. On success: WhatsApp/SMS receipt to both parties, funds recorded to merchant balance net of fees.

### 4.3 Subscriptions & Recurring Billing
1. Merchant defines `Product` + recurring `Price`.
2. Customer enrolls via Checkout with `mode=subscription`; payment method tokenized with a recurring mandate.
3. Cron billing engine generates `Invoice` on each cycle boundary.
4. **Attempt 1 (auto-debit):** `PaymentIntent` created against saved `PaymentMethod`. Success → `invoice.paid`, cycle extended.
5. **Attempt 1 fails or times out:** Invoice → `past_due`. Dunning engine sends WhatsApp/SMS with a single-click `PaymentLink` fallback, retries at Day 1/3/7.
6. Retries exhausted → `Subscription` → `canceled` or `unpaid` per merchant policy.
7. **Proration:** on upgrade/downgrade mid-cycle, generate an immediate prorated `Invoice` (credit or charge) for the difference between old and new `Price`, time-weighted by days remaining in the current period. Do not silently swap the price without a proration invoice — this is the single most common Stripe-parity gap.

### 4.4 Standalone Invoicing (new — required for parity)
1. Merchant creates an `Invoice` directly (no `Subscription`), sets `is_standalone = true`, line items, due date.
2. Invoice sent to customer via email/WhatsApp with a payment link attached.
3. Customer pays like any `PaymentLink` flow → `PaymentIntent` → `invoice.paid`.
4. Use case: freelancers/agencies billing clients ad hoc — common in the target market.

### 4.5 Refunds (new — required for parity)
1. Merchant initiates refund from dashboard or `POST /v1/refunds` against a `Charge` (full or partial amount).
2. Adapter-specific refund call: card refunds route back through the acquirer; wallet refunds route back through JazzCash/EasyPaisa reversal APIs (note: wallet reversal windows are often time-limited — flag to merchant if outside window).
3. On success: `Refund.status = succeeded`, reversing `LedgerEntry` rows created (credit acquiring settlement, debit merchant payable, debit fee revenue proportionally).
4. `charge.refunded` event fires.

### 4.6 Disputes / Chargebacks (new — required for parity)
1. Card network or wallet provider notifies platform of a dispute via their callback/report feed.
2. `Dispute` created in `needs_response`, `evidence_due_by` set per network rules.
3. Merchant dashboard surfaces the dispute; merchant uploads evidence (delivery proof, customer communication) before deadline.
4. Platform submits evidence to the network; outcome (`won`/`lost`) updates the dispute and, if lost, reverses funds from the merchant's balance (ledger entries) and typically applies a dispute fee.

### 4.7 Customer Portal (new — required for parity)
A self-service, Stripe-hosted-equivalent page (`portal.yourdomain.pk/session/...`) generated per customer session, where the customer can:
- View invoice/payment history
- Update saved payment method (re-tokenize card, re-link wallet)
- Cancel or change (upgrade/downgrade) their own subscription (triggers 4.3 proration flow)
- Download invoice as PDF

This does **not** exist in the current design and is a top-priority gap — without it, every plan change or card update becomes a manual support request to the merchant.

---

## 5. State Machines

### 5.1 PaymentIntent (expanded — adds the ambiguous/timeout state)

```
requires_payment_method
        │  (customer submits payment info)
        ▼
    processing
    ├── rail confirms success ─────────► succeeded
    ├── rail confirms failure/decline ──► requires_payment_method (retry allowed)
    └── rail times out / no response ──► requires_reconciliation   ← NEW
                                              │
                              (reconciliation job matches provider statement)
                                              │
                          ┌───────────────────┴───────────────────┐
                          ▼                                       ▼
                      succeeded                                 failed
```

**Critical rule:** `requires_reconciliation` must never be auto-retried by the customer-facing retry button. A second charge attempt while the first is ambiguous is how customers get double-charged. Only the reconciliation job (§6) or manual merchant/support action can resolve this state.

### 5.2 Subscription (expanded — adds proration trigger)

```
incomplete ──(first payment succeeds)──► trialing / active
                                              │
                          (upgrade/downgrade mid-cycle) ──► generates proration Invoice, status unchanged
                                              │
                                    (recurring payment fails)
                                              ▼
                                          past_due ──(dunning retries exhausted)──► canceled
                                              │
                                (payment succeeds during dunning window)
                                              ▼
                                            active
```

### 5.3 Refund (new)

```
pending ──(adapter confirms reversal)──► succeeded
   │
   └──(adapter rejects / window expired)──► failed
```

### 5.4 Dispute (new)

```
needs_response ──(merchant submits evidence)──► under_review ──► won / lost
       │
       └──(deadline passes, no evidence)──► lost (auto)
```

---

## 6. Reconciliation Engine (new — highest priority addition)

This is the single most important missing piece in the original design and the most common real-world failure point for Pakistani payment gateways, because wallet callbacks (JazzCash/EasyPaisa) drop or arrive late more often than card rails do.

**Design:**
1. A scheduled job (every 5–15 min) pulls settlement/transaction statement files or APIs from each rail (JazzCash reconciliation file, EasyPaisa settlement API, acquirer batch file, Raast core statement).
2. For every `PaymentIntent` sitting in `processing` or `requires_reconciliation` older than a threshold (e.g., 2 minutes), match against the provider statement by `rail_reference_id`.
3. Write a `ReconciliationRecord` for every match/mismatch.
4. If provider confirms success but platform shows pending/failed → transition to `succeeded`, fire the event as if it just completed (webhook still fires — merchants should not need to know reconciliation happened after the fact).
5. If provider confirms failure/no record found after a safe window (e.g., 24 hrs) → transition to `failed`.
6. Mismatches (provider says success, platform independently already marked failed, or vice versa) get flagged for manual ops review — never silently overwritten.

This job is what makes the "ambiguous" state in §5.1 safe to have at all — without it, `requires_reconciliation` transactions would simply get stuck.

---

## 7. Payment Rail Adapters

All adapters implement:

```
interface IPaymentAdapter {
  initiateCharge(paymentIntent, paymentMethod, idempotencyKey): ChargeResult
  checkStatus(rail_reference_id): ChargeStatus
  initiateRefund(charge, amount): RefundResult
  handleCallback(rawPayload, signatureHeader): NormalizedEvent
}
```

**Idempotency requirement:** every `initiateCharge` call must pass the `idempotency_key` down to the rail request itself (as an HTTP header or request field where the rail supports it, or as a dedupe check against `rail_reference_id` where it doesn't). This must live at the adapter layer, not just the API gateway layer — a network timeout mid-charge is exactly the case where the gateway-level idempotency check has already passed and the adapter is about to retry against the rail itself.

| Rail | Protocol | Notes |
|---|---|---|
| JazzCash | REST/JSON, HMAC-SHA256 signed | Response codes mapped: `000`→success, `124`→invalid PIN, `157`→timeout→`requires_reconciliation` |
| EasyPaisa | REST/HTTPS, OAuth2/RSA | Track `transactionId`, validate callback signature |
| Raast P2M | ISO 20022 XML/REST via **sponsor bank** — see note below | EMVCo QR generation, E2EID tracking |
| 1Link/Cards | ISO 8583 or gateway REST via local acquirer | 3DS v2.2 challenge/frictionless for PayPak/Visa/Mastercard |

**Important correction on Raast:** the platform cannot connect to SBP's Raast rail directly as a non-bank PSP. Integration must go through a **participant/sponsor bank** (e.g., a commercial bank that is a direct Raast member and offers API access to PSPs). Model this explicitly as `RaastAdapter(sponsor_bank: "Bank X")` rather than a direct SBP connection — this affects onboarding timeline and a commercial agreement, not just code.

---

## 8. Event & Webhook Engine

- Every state transition writes an immutable `Event` row and enqueues delivery.
- Signature header: `X-Platform-Signature: t={timestamp},v1={HMAC-SHA256({timestamp}.{payload}, whsec)}`.
- Retry backoff on non-2xx or >5s timeout: 5 min → 15 min → 1 hr → 6 hr → 12 hr → 24 hr.
- Circuit breaker: 3 consecutive days of failures → endpoint auto-disabled, merchant notified.
- **New: Event log & manual replay UI.** Merchant dashboard must show delivery status per event and allow manual "resend" — without this, a merchant whose server had downtime has no way to recover missed fulfillment events except contacting support.

---

## 9. Ledger, Fees, and Payouts

Double-entry, immutable, append-only. Example for a PKR 10,000 card transaction (2.5% fee + 13% PRA tax on fee):

```
[Debit]  Acquiring Settlement Account:   PKR 10,000.00
[Credit] Merchant Payable Account:       PKR  9,717.50
[Credit] Gateway Fee Revenue Account:    PKR    250.00
[Credit] Provincial Tax Payable:         PKR     32.50
```

**Refund reversal** (new): a refund of the same transaction must post the mirrored entries — debit merchant payable, credit acquiring settlement, and a proportional reversal of the fee/tax lines if the platform's refund policy returns fees (merchant-dependent, make this configurable per merchant).

**Payouts:** T+1 (Tier 2) / T+2 (Tier 1), rolling reserve holdback (e.g. 5% / 30 days) configurable per merchant risk category. Daily 14:00 PKT batch payout via 1Link IBFT / Raast, emitting `payout.created` / `payout.paid`.

---

## 10. Merchant Onboarding & KYC

| Tier | Verification | Monthly Limit |
|---|---|---|
| Tier 0 (Sandbox) | Email + Phone OTP | PKR 0 (test only) |
| Tier 1 (Sole Prop) | CNIC, biometric, IBAN title match | Up to PKR 500,000 |
| Tier 2 (Corporate) | SECP Form A/29, NTN, board resolution | Unlimited |

Verification integrations: NADRA Verisys (CNIC), FBR (NTN), 1Link Title Fetch (bank account title match). On approval: `merchant.kyc_status = approved`, live keys unlocked.

---

## 11. Feature Parity Checklist vs. Stripe

**Must-have for MVP parity (not in original doc, added here):**
- [ ] Customer Portal (self-service)
- [ ] Refunds (full/partial)
- [ ] Disputes/Chargebacks
- [ ] Coupons/Discounts
- [ ] Proration on plan changes
- [ ] Standalone invoicing (non-subscription)
- [ ] Reconciliation engine + ambiguous PaymentIntent state
- [ ] Adapter-level idempotency

**Important, can follow MVP:**
- [ ] Merchant analytics (MRR, churn, revenue breakdown)
- [ ] Team roles/permissions (Owner/Admin/Analyst)
- [ ] API versioning per merchant
- [ ] Webhook event log + manual replay in dashboard
- [ ] Client-side embeddable SDK (Elements-equivalent) for custom UI, beyond hosted Checkout

**Out of scope — do not build:**
- Multi-currency (PKR-only domestic platform)
- Marketplace/Connect-style split payments (unless the product later pivots to multi-vendor)
- Usage-based/metered billing (only if a specific vertical needs it later)

---

## 12. Implementation Priority Order (for Claude Code)

1. **Unify the data layer** — migrate all standalone feature tables into the schema in §2, with `sandbox`/`production` schema separation (§3).
2. **Build the PaymentIntent + Charge orchestrator** as the single entry point; refactor Checkout and Payment Links to stop calling rails directly.
3. **Wrap existing rail code into `IPaymentAdapter` implementations**, adding idempotency keys at this layer.
4. **Add the `requires_reconciliation` state and build the reconciliation job** (§6) — this unblocks safe handling of the most common real-world failure mode.
5. **Add Refund and Dispute entities + flows** (§4.5, §4.6).
6. **Build the Customer Portal** (§4.7) — self-service card update + subscription management.
7. **Wire the event bus and webhook delivery**, including the merchant-facing event log/replay UI.
8. **Add Coupons/Discounts and proration logic** to Subscriptions and Payment Links.
9. **Add Standalone Invoicing.**
10. **Build the sandbox simulator** (§3.1) so integration testing doesn't depend on live rail sandboxes.
11. Analytics, roles/permissions, API versioning, embeddable SDK — post-MVP.

---

## 13. Merchant Onboarding & Dashboard Experience (World-Class Parity)

This section specs the merchant-facing flows and dashboard surfaces needed to match a Stripe-caliber experience. No visual/UI design here — this is behavior, information architecture, and widget content only, mapped back to the entities in §2 and workflows in §4.

### 13.1 Signup & Instant Activation
- Signup fields: email, password (or OAuth), business name, mobile number. Nothing else.
- On submit: `Merchant` created with `kyc_tier = 0`, `kyc_status = unverified`. Test key pair (`pk_test_`, `sk_test_`) generated instantly; live key pair generated but `disabled`.
- No CNIC/SECP documents required at signup — a merchant can start building immediately, matching Stripe's "build before you're verified" model.
- User lands directly in the dashboard, in Test Mode, not a marketing/docs page.

### 13.2 Progressive KYC / Go-Live Checklist
- Persistent Home-dashboard widget: "Activate your account to accept real payments," with a checklist:
  - Add business details (CNIC / SECP+NTN, depending on entity type)
  - Add settlement bank account (IBAN) and verify title match
  - Confirm a webhook endpoint (optional, dismissible)
  - Create a first product or payment link
- Each item deep-links to the exact settings page; a progress bar shows completion %.
- On KYC approval, merchant auto-upgrades tier (per §10 table), live keys auto-enable, and the checklist widget disappears.

### 13.3 Global Test/Live Mode Switch
- One persistent toggle in the top nav, visible on every screen — not buried in settings.
- Switching modes repoints all dashboard queries to the corresponding schema (`sandbox`/`production`, §3); no page reload required.
- Test Mode must be visually distinguishable everywhere in the dashboard so a merchant can never mistake test data for live data (requirement, not a specific style).
- API keys, payment lists, customer lists, and balance are all scoped to the currently active mode.

### 13.4 Dashboard Information Architecture
- Home
- Payments
- Customers
- Product Catalog
- Payment Links
- Subscriptions & Billing
- Invoices
- Disputes
- Balance & Payouts
- Developers (API Keys, Webhooks, Event Logs, Docs)
- Settings (Business Profile, Team, Branding)

### 13.5 Home Dashboard Widgets
- **Balance summary**: available balance, pending balance, next payout date/amount (from §9).
- **Volume widget**: today / 7-day / 30-day gross volume, broken down by rail (Card / JazzCash / EasyPaisa / Raast).
- **Recent Payments feed**: latest PaymentIntents with status badges, click-through to detail.
- **Quick actions**: one-click "Create Payment Link," "Create Invoice," "Add Product."
- **Go-Live checklist** (§13.2), shown only until KYC is complete.

### 13.6 Payments Section
- Table of all `PaymentIntent`s: filter by status, date range, rail, amount, customer.
- Status badges reflect §5.1's state machine, with a distinct badge for `requires_reconciliation` so merchants read it as "we're checking this," not "failed."
- Detail view per payment: full timeline — intent created → charge attempt(s) → rail response → refunds/disputes → ledger breakdown (fee/tax/net) — mirroring Stripe's payment timeline view.
- One-click Refund action directly from the detail view (§4.5).

### 13.7 Customers Section
- List + search of `Customer` records.
- Detail view: contact info, saved payment methods, active subscriptions, invoice/payment history. This is the internal admin-facing counterpart to the customer-facing Portal (§4.7).

### 13.8 Product Catalog & Payment Links
- Product/Price builder: name, one-time vs. recurring toggle, amount, billing interval.
- Payment Link builder: pick a product or set an ad-hoc amount, single-use/multi-use toggle, custom fields, optional coupon attach; generates a shareable slug and QR code for social/in-person sharing.
- Link performance widget: views vs. completed payments (conversion rate) per link.

### 13.9 Subscriptions & Billing
- MRR widget; counts of active / trialing / past_due / canceled subscriptions.
- Subscription list + detail (current period, next invoice date, applied discount).
- Coupon manager: create/list coupons, redemption counts.
- Dunning activity feed: shows in-progress retry schedules for `past_due` subscriptions.

### 13.10 Invoices
- Standalone invoice creator (§4.4): line items, due date, send via WhatsApp/email.
- Invoice list with status filters (draft / open / paid / past_due / void).

### 13.11 Disputes
- Queue of disputes in `needs_response`, sorted by `evidence_due_by` urgency.
- Evidence submission flow: upload delivery proof/communication before the deadline.
- Historical won/lost record per merchant, informing their ongoing risk profile.

### 13.12 Balance & Payouts
- Available vs. pending balance breakdown.
- Payout schedule and history (T+1/T+2, §9).
- Rolling reserve visibility — merchant sees *why* funds are held, not just a lower balance.
- Ledger export (CSV) for the merchant's own accounting reconciliation.

### 13.13 Developers Section
- API key management: view/rotate test and live keys; secret vs. publishable keys kept visually and functionally distinct.
- Webhook management: add endpoint, select event types, view delivery log with manual replay (§8).
- Event log: raw payloads, searchable by type/date.
- Embedded quickstart snippets pre-filled with the merchant's own test key — copy-pasteable code that already works against their account, matching Stripe's docs experience.

### 13.14 Settings
- Business profile (KYC documents, tier status).
- Team members (roles ship post-MVP per §11, but this settings slot should exist from day one).
- Branding (logo/colors for hosted Checkout pages and Payment Links).

---

## 14. Open Questions to Resolve Before / During Build

- Which bank will act as **Raast sponsor** for P2M integration, and what's their API/onboarding timeline?
- Refund policy: does the platform return its fee/tax portion on a refund, or only the net amount? (Affects §9 ledger logic — make configurable per merchant if uncertain.)
- Wallet reversal time windows for JazzCash/EasyPaisa refunds — confirm actual provider limits so the Refund flow can reject requests outside the window pre-emptively rather than failing at the adapter call.
- Dispute evidence deadlines per card network (Visa/Mastercard/PayPak) — needed to set `evidence_due_by` accurately.
- Rolling reserve percentage and hold period per merchant risk tier — needs a real risk policy, not just a placeholder number.
- What volume/amount is a Tier 0 merchant allowed to process in Test Mode before being nudged toward KYC — is there a hard cap on test-mode API calls/data retention?
- Does the "add a webhook endpoint" checklist item block go-live, or stay optional indefinitely? (Affects whether §13.2's checklist item can be skipped permanently.)
