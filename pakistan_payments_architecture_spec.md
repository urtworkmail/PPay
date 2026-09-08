# System Architecture & Workflow Design Specification: Domestic Payment Gateway Platform (PPay)

## Executive Summary & Architectural Vision

This document outlines the end-to-end operational workflows, domain entity relationships, state machines, and integration patterns for building a domestic, full-stack payment processor and orchestration platform for Pakistan.

The core problem identified in the current system is **modular decoupling without orchestration**: individual modules (e.g., payment rail connectors, link generators, merchant auth, billing scripts) exist in isolation, lacking a unified data model, event-driven state transitions, and a central orchestration engine.

This specification serves as a blueprint for AI agents and software architects to connect these disconnected components into a cohesive, developer-first platform fully tailored to Pakistan's financial ecosystem (JazzCash, EasyPaisa, Raast, 1Link PayPak/IBFT, local Visa/Mastercard acquisition, and SBP regulatory requirements).

---

## 1. High-Level System Architecture & Component Mapping

To transform disconnected features into a unified gateway, the system must follow an **Event-Driven Architecture (EDA)** with an immutable ledger core.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               CLIENT / FRONTEND INTERFACES                       │
│  ┌────────────────────────┐   ┌───────────────────────────┐   ┌───────────────┐ │
│  │ Hosted Checkout Page   │   │ No-Code Payment Links UI │   │ Merchant Dash │ │
│  └───────────┬────────────┘   └─────────────┬─────────────┘   └───────┬───────┘ │
└──────────────┼──────────────────────────────┼─────────────────────────┼─────────┘
               │                              │                         │
┌──────────────▼──────────────────────────────▼─────────────────────────▼─────────┐
│                               API GATEWAY & ROUTER LAYER                       │
│  - Authentication (Bearer Token / API Keys: pk_live, sk_live, pk_test, sk_test) │
│  - Environment Switcher (Sandbox DB vs. Production DB routing)                  │
│  - Idempotency & Rate Limiting Middleware                                       │
└─────────────────────────────────────────────┬───────────────────────────────────┘
                                              │
┌─────────────────────────────────────────────▼───────────────────────────────────┐
│                           CORE ORCHESTRATION & DOMAIN SERVICES                   │
│                                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌──────────────────┐ │
│  │ Merchant Account Service│  │ Payment Intent Engine   │  │ Customer Service │ │
│  └─────────────────────────┘  └────────────┬────────────┘  └──────────────────┘ │
│                                            │                                    │
│  ┌─────────────────────────┐  ┌────────────▼────────────┐  ┌──────────────────┐ │
│  │ Subscription Engine     │  │ Payment Link Service    │  │ Invoice Engine   │ │
│  └─────────────────────────┘  └─────────────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────┬───────────────────────────────────┘
                                              │
┌─────────────────────────────────────────────▼───────────────────────────────────┐
│                         EVENT BUS & ASYNCHRONOUS ENGINE                         │
│  - Message Broker (RabbitMQ / Apache Kafka)                                     │
│  - Event Dispatcher (Emits: payment_intent.succeeded, invoice.paid, etc.)       │
│  - Webhook Delivery Service (HMAC Signing, Exponential Backoff Retries)          │
└──────────────┬──────────────────────────────┬─────────────────────────┬─────────┘
               │                              │                         │
┌──────────────▼──────────┐      ┌────────────▼────────────┐   ┌────────▼─────────┐
│ DOMESTIC PAYMENT RAILS  │      │ IMMUTABLE LEDGER ENGINE │   │ SANDBOX SIMULATOR│
│ - JazzCash MWallet API  │      │ - Double-Entry Accounting│   │ - Mock Rails     │
│ - EasyPaisa MWallet API │      │ - Merchant Balances     │   │ - Test Clock     │
│ - Raast Instant (P2M)   │      │ - SBP Reserve Holdback  │   │ - Virtual OTP    │
│ - 1Link PayPak / Cards  │      │ - Batch Payout Generator│   │   Simulator      │
└─────────────────────────┘      └─────────────────────────┘   └──────────────────┘
```

---

## 2. Universal Entity & Data Model Schema

All workflows rely on a shared, normalized domain schema. Disconnected modules must reference these canonical entities.

```
       ┌──────────────┐
       │   Merchant   │
       └──────┬───────┘
              │ 1
              │
              │ N
       ┌──────▼───────┐ 1         N ┌──────────────┐
       │   Customer   ├────────────►│ PaymentMethod│ (Saved Cards, Wallet Accounts, Raast Aliases)
       └──────┬───────┘             └──────────────┘
              │ 1
              │
              │ N
       ┌──────▼───────┐ 1         N ┌──────────────┐
       │ Subscription ├────────────►│   Invoice    │
       └──────┬───────┘             └──────┬───────┘
              │                            │
              └──────────────┬─────────────┘
                             │
                             ▼ 1 (via Source / Reference)
                     ┌──────────────┐
                     │ PaymentIntent│
                     └──────┬───────┘
                            │ 1
                            │
                            │ 1..N
                     ┌──────▼───────┐
                     │    Charge    │
                     └──────┬───────┘
                            │ 1
                            │
                            │ 1..N
                     ┌──────▼───────┐
                     │ LedgerEntry  │
                     └──────────────┘
```

### Key Entity Descriptions

1. **Merchant**: Represents the business entity. Contains KYC status (CNIC, NTN, SECP incorporation, SBP tier), bank account details for settlement, live/test API keys, and webhook configuration.
2. **Customer**: Represents the end payer. Stores contact info (Mobile Number, Email) and mapped tokenized payment methods (`PaymentMethod`).
3. **PaymentMethod**: Tokenized abstraction covering domestic cards (PayPak, Visa, Mastercard), Mobile Wallets (JazzCash, EasyPaisa), or Raast ID/Alias.
4. **PaymentIntent**: The primary transaction orchestration object. Tracks the full payment lifecycle from creation to authorization, capture, or failure.
5. **Charge**: The actual execution attempt on a payment rail (e.g., calling JazzCash Direct Debit API or 1Link Gateway). A single `PaymentIntent` can have multiple `Charges` if retries occur.
6. **Product & Price**: Catalog system storing items, pricing models (one-time vs. recurring), currency (`PKR`), and recurring billing intervals (weekly, monthly, yearly).
7. **Subscription**: Links a `Customer` to one or more `Prices`. Manages recurring billing schedules, trial periods, and dunning (retry logic).
8. **Invoice**: Statement of amounts owed for subscriptions or one-off billing. Generates corresponding `PaymentIntent` objects.
9. **PaymentLink**: Reusable or single-use URL wrapper around a `Price` or `PaymentIntent` that serves a hosted payment page.
10. **LedgerEntry**: Double-entry accounting transaction record capturing Gross Amount, Gateway Fees, Sales Tax (PRA/SRA/FBR withholding), Net Merchant Credit, and Reserve Holdbacks.

---

## 3. End-to-End Workflow Journeys

### Workflow A: Custom API Hosted Checkout Flow

This workflow applies when a merchant integrates via custom API and presents the hosted checkout interface to the buyer.

#### End-to-End Step-by-Step Journey:

1. **Session Creation (Merchant Backend -> Gateway API)**:
   - Merchant app makes a POST request to `/v1/checkout/sessions` with line items, amount in PKR paisas (`100000` = PKR 1,000.00), success/cancel URLs, and allowed local payment methods (`["jazzcash", "easypaisa", "raast", "card"]`).
   - Gateway verifies authentication using `sk_live_...` or `sk_test_...`.
   - Gateway creates a `PaymentIntent` in state `requires_payment_method` and generates a secure Checkout Session URL (`https://checkout.yourdomain.pk/pay/cs_test_abc123`).

2. **Customer Redirection & Payment Method Selection**:
   - Merchant redirects buyer to the Hosted Checkout page.
   - Hosted Checkout renders local payment methods based on merchant configurations:
     - **Card**: Credit/Debit (Visa, Mastercard, PayPak).
     - **Mobile Wallet**: JazzCash or EasyPaisa (requires entering 11-digit mobile number `03XXXXXXXXX`).
     - **Raast**: Dynamic Raast QR or Static Alias / IBAN generated for push payments.

3. **Execution by Domestic Payment Rail**:
   - **Scenario 1: Mobile Wallet (JazzCash / EasyPaisa)**:
     - Gateway sends an asynchronous Direct Debit / USSD Push request to the wallet provider.
     - Buyer receives a USSD prompt on their mobile phone or an in-app notification to enter their 4/5-digit secret MPIN.
     - Gateway polls wallet status or awaits wallet callback webhook.
   - **Scenario 2: Card (3D Secure)**:
     - Gateway initiates transaction with local acquiring bank (e.g., Meezan, HBL, Alfalah).
     - Buyer is prompted for 3DS OTP sent via SMS/Email by issuing bank.
   - **Scenario 3: Raast P2M (Request to Pay / Dynamic QR)**:
     - Gateway generates a dynamic Raast transaction reference and QR code.
     - Buyer opens their banking app, scans QR code / enters Raast ID, and approves payment.

4. **Processing & Verification**:
   - The Gateway's Rail Connector receives success/failure status from the network.
   - System updates `PaymentIntent` state:
     - If success: `requires_payment_method` → `processing` → `succeeded`.
     - If failure: `requires_payment_method` → `requires_payment_method` (allowing retry with another method) or `failed`.

5. **Asynchronous Fulfillment & Redirection**:
   - Gateway fires `checkout.session.completed` and `payment_intent.succeeded` events to the Event Bus.
   - Webhook Engine signs payload with HMAC-SHA256 and pushes to Merchant's registered webhook endpoint.
   - Buyer browser is redirected to Merchant's `success_url` with session token.

```
[Merchant App] --(1. Create Session)--> [Gateway API] --(2. Return URL)--> [Merchant App]
                                                                                │
                                                                       (3. Redirect User)
                                                                                │
                                                                                ▼
[Local Rail API] <--(5. Process Payment)-- [Hosted Checkout Page] <─────────────┘
       │                                        │
 (6. Success)                              (7. Browser Redirect)
       │                                        │
       ▼                                        ▼
[Gateway Core Engine]                     [Merchant Success Page]
       │
 (8. Async Webhook)
       │
       ▼
[Merchant Backend (Fulfill Order)]
```

---

### Workflow B: Payment Links Workflow (No-Code Integration)

Designed for SMBs, Instagram sellers, freelancers, and utility bill collectors in Pakistan who do not have complex websites or backend infrastructure.

#### End-to-End Step-by-Step Journey:

1. **Link Creation (Merchant Dashboard)**:
   - Merchant logs into the Platform Dashboard.
   - Navigates to **Payment Links** → **Create New Link**.
   - Selects or creates a Product (e.g., "Custom Leather Bag - PKR 4,500").
   - Configures options: Single-use vs Multi-use, custom fields to collect from buyer (e.g., Delivery Address, WhatsApp Number, CNIC for tax invoice), and custom branding.
   - Clicks "Generate Link". Platform stores record in `payment_links` table and returns short URL (`https://pay.yourdomain.pk/l/bag-4500`).

2. **Link Sharing**:
   - Merchant pastes link on WhatsApp, Instagram DM, Facebook Page, or SMS.

3. **Buyer Payment Journey**:
   - Buyer clicks link on mobile phone; mobile-optimized hosted checkout loads instantly.
   - Buyer enters name, WhatsApp number, shipping address.
   - Selects payment option (e.g., **EasyPaisa**).
   - Enters EasyPaisa account number (`03001234567`).

4. **Payment Processing**:
   - Platform underlying engine dynamically initializes a `PaymentIntent` bound to the `PaymentLink` ID.
   - Wallet push request sent to buyer's phone. Buyer approves via MPIN.

5. **Notification & Settlement**:
   - Real-time confirmation displayed to buyer on web page.
   - WhatsApp message / SMS notification dispatched to both Merchant and Buyer confirming payment receipt.
   - Funds recorded in Merchant's Platform Balance (Gross: PKR 4,500, Fee: PKR 112.50 [2.5%], Net Credit: PKR 4,387.50).

---

### Workflow C: Subscriptions & Recurring Billing Workflow

Tailored for SaaS products, subscription boxes, gym memberships, online schools, and recurring bill payments in Pakistan.

#### Challenges Handled:
Auto-debit in Pakistan requires navigating specific bank / wallet mandates. The platform handles both **automated auto-debit (Card / Raast recurring mandate)** and **push-based recurring invoices (via SMS / WhatsApp payment links)**.

#### End-to-End Step-by-Step Journey:

1. **Catalog Setup**:
   - Merchant creates a `Product` ("Monthly Tuition") and `Price` (PKR 5,000 / Month, Billing Day: 1st of month).

2. **Customer Enrollment / Subscription Initialization**:
   - Merchant enrolls customer via API or Checkout Page with `mode="subscription"`.
   - Customer provides initial payment method and approves a recurring payment mandate.
   - Platform creates `Subscription` entity in status `active` or `trialing`.

3. **Automated Billing Engine Cycle (Cron / Schedule Service)**:
   - On the recurring interval date (e.g., 1st of every month at 00:00 PKT):
   - Subscription engine generates an `Invoice` object with line items.
   - Status set to `draft` → `open`.

4. **Execution & Dunning Logic**:
   - **Attempt 1: Auto-Debit (Saved Card / Wallet Mandate)**:
     - Platform creates `PaymentIntent` against saved `PaymentMethod`.
     - If successful: Invoice marked `paid`. `invoice.paid` event dispatched. Subscription extended for next cycle.
   - **Attempt 2: Failed Auto-Debit / Push-based fallback**:
     - If card/wallet fails (insufficient funds, expired card, network timeout):
     - Invoice status set to `past_due`.
     - **Automated Dunning Engine triggers**:
       - Sends WhatsApp / SMS notice to buyer with an embedded single-click Payment Link.
       - Schedule retry charges at Day 1, Day 3, Day 7.
     - If all retries fail after grace period, subscription state transitions from `past_due` → `canceled` or `unpaid`.

```
                        ┌──────────────────────────────┐
                        │ Cron Billing Engine (Day 1)  │
                        └──────────────┬───────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │  Generate Invoice & Intent   │
                        └──────────────┬───────────────┘
                                       │
                        ┌──────────────▼───────────────┐
                        │ Attempt Auto-Debit on Target │
                        └──────────────┬───────────────┘
                                       │
                   ┌───────────────────┴───────────────────┐
            SUCCESS│                                       │FAILURE
                   ▼                                       ▼
     ┌───────────────────────────┐           ┌───────────────────────────┐
     │ Mark Invoice status = PAID│           │ Mark status = PAST_DUE    │
     │ Extend Subscription Cycle │           │ Trigger Dunning Engine    │
     └───────────────────────────┘           └─────────────┬─────────────┘
                                                           │
                                             ┌─────────────▼─────────────┐
                                             │ Dispatch WhatsApp / SMS   │
                                             │ Link + Retry in 3 Days    │
                                             └───────────────────────────┘
```

---

### Workflow D: Merchant Sign-Up, Onboarding, KYC & Test Mode Sandbox

To enable frictionless onboarding while remaining fully compliant with State Bank of Pakistan (SBP) PSP/PSO regulations.

#### Step 1: Instant Sign-Up & Sandbox Provisioning
- Merchant signs up with Email, Password, Mobile Number, and Business Name.
- Platform **instantly** generates two pairs of API Keys:
  - **Test Public Key**: `pk_test_...`
  - **Test Secret Key**: `sk_test_...`
  - **Live Public Key**: `pk_live_...` (Disabled until KYC approval)
  - **Live Secret Key**: `sk_live_...` (Disabled until KYC approval)
- Merchant immediately enters **Sandbox / Test Mode** without submitting formal documents.

#### Step 2: Test Mode Capabilities & Virtual Simulator
In Sandbox Mode, merchants can integrate and test all workflows programmatically:
- **Test Keys Enforcement**: API requests using `sk_test_...` route to sandbox database schemas and mock payment connectors.
- **Mock Local Payment Rails**:
  - Test Card Numbers (e.g., `4242_4242_4242_4242` for Instant Success, `4000_0000_0000_0002` for 3DS Failure, `4000_0000_0000_0051` for Insufficient Funds).
  - Test Mobile Wallet Numbers (e.g., `03000000000` auto-triggers USSD success prompt; `03000000001` simulates timeout/decline).
  - Test Raast Alias (`test-merchant@raast` auto-returns mock transaction ID).
- **Test Clocks**: Merchants can manipulate time in sandbox to test subscription renewal cycles, trial expirations, and dunning workflows without waiting days/months.
- **Local Webhook CLI & Tunneling**:
  - Developers run CLI tool (`ppay listen --forward-to localhost:8000/webhook`) to route sandbox events directly to their local development server.

#### Step 3: Merchant KYC Tiering & Verification Journey (Going Live)
To accept real PKR money, merchants submit business verification in the dashboard:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           KYC TIERING STRUCTURE                         │
├───────────────────┬───────────────────────────────┬─────────────────────┤
│ Tier Level        │ Verification Required         │ Monthly Limit       │
├───────────────────┼───────────────────────────────┼─────────────────────┤
│ Tier 0 (Sandbox)  │ Email & Phone OTP             │ PKR 0 (Test Only)   │
│ Tier 1 (Sole Prop)│ CNIC, Biometric, IBAN Title   │ Up to PKR 500,000   │
│ Tier 2 (Corporate)│ SECP Form A/29, NTN, Board Res│ Unlimited           │
└───────────────────┴───────────────────────────────┴─────────────────────┘
```

1. Merchant uploads CNIC scan, Business Bank Statement, and Bank Account Title Verification letter via Dashboard.
2. Platform automated verification service connects to:
   - **NADRA Verisys API** for CNIC authenticity.
   - **FBR API** for NTN validation.
   - **1Link Title Fetch API** to verify merchant bank account title matches registered business name.
3. Upon approval, system sets `merchant.status = active`, unlocks `pk_live_...` and `sk_live_...`, and enables production payout routing.

---

## 4. Local Pakistani Payment Rail Integration Specifications

To connect the disconnected modules, the Platform must implement dedicated adapters for local payment networks behind a unified interface (`IPaymentAdapter`).

```
                          ┌───────────────────────────┐
                          │   IPaymentAdapter (Interface)
                          └─────────────┬─────────────┘
                                        │
      ┌───────────────────┬─────────────┴───────┬──────────────────┐
      │                   │                     │                  │
┌─────▼──────┐      ┌─────▼──────┐        ┌─────▼──────┐    ┌─────▼──────┐
│ JazzCash   │      │ EasyPaisa  │        │ Raast P2M  │    │ 1Link Cards│
│ Adapter    │      │ Adapter    │        │ Adapter    │    │ Adapter    │
└────────────┘      └────────────┘        └────────────┘    └────────────┘
```

### 1. JazzCash Integration Engine
- **Protocol**: REST / JSON with HMAC SHA256 request signing using Merchant Password & Hash Key.
- **Flow**: Initiates MWallet payment request passing customer phone number. Listener handles async callback XML/JSON payload.
- **Error Mapping**: Maps JazzCash response codes (`000` = Success, `124` = Invalid PIN, `157` = Timeout) to standardized Platform error codes (`payment_denied`, `incorrect_pin`, `gateway_timeout`).

### 2. EasyPaisa Integration Engine
- **Protocol**: REST API over HTTPS with OAuth2 / RSA token encryption.
- **Flow**: Initiates Direct Debit payload. Requires tracking `transactionId` and validating callback signature.

### 3. SBP Raast P2M (Person-to-Merchant) Engine
- **Protocol**: ISO 20022 XML / REST JSON over secure TLS tunnel connecting to SBP approved member bank.
- **Flow**:
  - Dynamically creates an End-to-End Transaction ID (`E2EID`).
  - Generates QR String complying with EMVCo standards.
  - Listens on WebSocket / HTTP callback for incoming credit notification from Raast core.

### 4. 1Link / Card Acquiring Engine
- **Protocol**: ISO 8583 or Gateway REST API connected to local acquirers (Meezan Bank, Bank Alfalah, CyberSource).
- **Flow**: Handles 3DS v2.2 challenge/frictionless flows for PayPak, Visa, and Mastercard cards.

---

## 5. State Machines & Lifecycle Specifications

To prevent race conditions and inconsistent transaction states, all domain objects must strictly follow deterministic state machines.

### 1. PaymentIntent State Machine

```
                  ┌──────────────────────────────┐
                  │   requires_payment_method    │
                  └──────────────┬───────────────┘
                                 │
                 (Customer submits payment info)
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │          processing          │
                  └──────┬────────────────┬──────┘
                         │                │
            (Rail confirms)              (Rail denies or times out)
                         │                │
                         ▼                ▼
            ┌─────────────────┐      ┌──────────────────────────────┐
            │    succeeded    │      │   requires_payment_method    │
            └─────────────────┘      └──────────────┬───────────────┘
                                                    │
                                           (Explicit cancellation)
                                                    │
                                                    ▼
                                     ┌──────────────────────────────┐
                                     │           canceled           │
                                     └──────────────────────────────┘
```

### 2. Subscription State Machine

```
                      ┌────────────────────────┐
                      │        incomplete      │
                      └───────────┬────────────┘
                                  │ (First payment succeeds)
                                  ▼
┌──────────────┐      ┌────────────────────────┐
│  trialing    ├─────►│         active         │
└──────────────┘      └───────────┬────────────┘
                                  │ (Payment fails)
                                  ▼
                      ┌────────────────────────┐
                      │        past_due        │
                      └───────────┬────────────┘
                                  │ (Max retries exceeded)
                                  ▼
                      ┌────────────────────────┐
                      │        canceled        │
                      └────────────────────────┘
```

---

## 6. Event-Driven Webhook Engine Architecture

Disconnected systems fail because they rely on synchronous response chains. The platform MUST use an asynchronous Webhook Delivery Engine.

### 1. Event Generation & Structure
Every state transition produces an immutable `Event` record in JSON format.

#### Sample Payload (`payment_intent.succeeded`):
```json
{
  "id": "evt_test_987654321",
  "object": "event",
  "type": "payment_intent.succeeded",
  "created": 1721678400,
  "livemode": false,
  "data": {
    "object": {
      "id": "pi_3MtwB2LkdIwHu7ix08pBvXyZ",
      "object": "payment_intent",
      "amount": 450000,
      "currency": "pkr",
      "status": "succeeded",
      "payment_method_type": "easypaisa",
      "customer_details": {
        "name": "Ali Khan",
        "phone": "+923001234567"
      },
      "metadata": {
        "order_id": "ORD-10928"
      }
    }
  }
}
```

### 2. Secure HMAC Signature Verification
To prevent spoofing attacks, all webhooks sent to merchants include a signature header:
`X-PPay-Signature: t=1721678400,v1=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08`

- `t` = Timestamp
- `v1` = HMAC-SHA256 signature calculated over `${t}.${json_payload}` using the merchant's Webhook Secret (`whsec_...`).

### 3. Retry Strategy & Dead-Letter Queue (DLQ)
If a merchant's server returns a non-2xx HTTP code or times out (5 seconds threshold):
- **Backoff Schedule**: Exponential backoff retries at 5 mins, 15 mins, 1 hr, 6 hrs, 12 hrs, 24 hrs.
- **Circuit Breaker**: If endpoint fails continuously for 3 days, disable webhook endpoint and notify merchant via email/dashboard.

---

## 7. Financial Ledger, Fees & Payout Engine

A robust payment gateway requires strict double-entry ledger bookkeeping for every PKR paisa processed.

### 1. Double-Entry Accounting Schema
Every successful payment creates entries in the internal `ledger_entries` table:

#### Example: PKR 10,000 transaction processed via Card (2.5% Fee + 13% PRA Sales Tax on Fee):
- **Gross Amount**: PKR 10,000.00
- **Gateway Fee (2.5%)**: PKR 250.00
- **Sales Tax on Fee (13% PRA)**: PKR 32.50
- **Total Deduction**: PKR 282.50
- **Net Merchant Credit**: PKR 9,717.50

#### Ledger Posting Rules:
```
[Debit]  Acquiring Bank Settlement Account:  PKR 10,000.00
[Credit] Merchant Payable Account:          PKR  9,717.50
[Credit] Gateway Fee Revenue Account:       PKR    250.00
[Credit] Provincial Tax Payable (PRA/SRA):   PKR     32.50
```

### 2. Settlement & Rolling Payout Engine (SBP Compliant)
- **Settlement Cycles**: Configurable per merchant tier (e.g., T+1 for Tier 2 corporate, T+2 for Tier 1 sole prop).
- **Rolling Reserve**: Configurable holdback (e.g., 5% held for 30 days) to mitigate chargeback risk for high-risk merchant categories.
- **Automated Batch Payouts**:
  - Daily at 14:00 PKT, the Payout Engine calculates settled funds available for payout (`balance.available`).
  - Constructs 1Link IBFT / Raast Batch Payment payload.
  - Dispatches funds directly to merchant's linked domestic bank account (IBAN).
  - Emits `payout.created` and `payout.paid` webhooks.

---

## 8. Implementation Checklist to Re-Connect System Architecture

To assemble the existing disconnected features into this unified architecture, follow this execution path:

1. **Unify Data Layer**:
   - Refactor all standalone feature databases to use the centralized schema (`Merchant`, `Customer`, `PaymentIntent`, `Charge`, `LedgerEntry`).
2. **Implement API Gateway & Context Router**:
   - Middleware must inspect the authorization header (`sk_test_...` vs `sk_live_...`) and automatically inject context (`is_sandbox: boolean`) into down-stream requests.
3. **Refactor Payment Methods into Adapters**:
   - Wrap JazzCash, EasyPaisa, Raast, and Card codebases into classes implementing the unified `IPaymentAdapter` interface.
4. **Build Central PaymentIntent Orchestrator**:
   - Ensure Checkout Pages and Payment Links do not directly communicate with payment rails; they must create and transition a `PaymentIntent`.
5. **Connect Event Bus & Webhook Dispatcher**:
   - Every state transition inside `PaymentIntent` or `Subscription` must publish an event to the queue.
6. **Implement Sandbox Engine**:
   - Divert test requests away from actual local bank rails to the Virtual Simulator.
