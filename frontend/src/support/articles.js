export const CATEGORIES = [
  { slug: "getting-started", title: "Getting started", description: "Account basics and your first payment." },
  { slug: "payments", title: "Payments", description: "Authorization, refunds, and failures." },
  { slug: "billing", title: "Billing & Subscriptions", description: "Invoices, recurring billing, dunning." },
  { slug: "payouts", title: "Payouts & Balances", description: "Fees, settlement, and when you get paid." },
  { slug: "account", title: "Account & Team", description: "Roles, API keys, branding." },
  { slug: "risk", title: "Disputes & Risk", description: "What's built today, what's on the roadmap." },
  { slug: "compliance", title: "Go-live & Compliance", description: "Moving from sandbox to real processing." },
];

const p = (text) => ({ type: "p", text });
const ul = (items) => ({ type: "ul", items });

export const ARTICLES = [
  // Getting started
  {
    slug: "what-is-sandbox-mode",
    category: "getting-started",
    title: "What is sandbox mode?",
    summary: "Every account starts here — deterministic, simulated payments, clearly labeled.",
    body: [
      p("Every PPay account starts in sandbox mode, and stays there until you complete Go Live review. In sandbox, every card, wallet, and bank-transfer payment is authorized by a deterministic simulation engine — never a real card network or bank."),
      p("This isn't a limited demo of a smaller feature set — it's the full product. Every page, every API endpoint, every webhook works exactly as it will once you go live. The only difference is what's underneath the authorization step."),
      p("Sandbox status is never hidden: every checkout page shows a \"Sandbox — no real funds move\" badge, and the dashboard is labeled Sandbox in the top bar."),
    ],
  },
  {
    slug: "first-payment",
    category: "getting-started",
    title: "Creating your account and first payment",
    summary: "From sign-up to a successful test transaction in a few minutes.",
    body: [
      p("Sign up with your business name, email, and password — this creates your merchant account and your first team member (as Owner) in one step."),
      p("The fastest way to see a payment end-to-end: go to Product catalog, create a product with a price, then open it and click \"Create link\" next to that price. Open the resulting link and pay with the test card 4242 4242 4242 4242."),
      p("For a code-first integration instead, see the developer documentation, linked from Developers → Documentation in the sidebar."),
    ],
  },
  {
    slug: "links-invoices-checkout",
    category: "getting-started",
    title: "Payment Links vs Invoices vs the Checkout API — which should I use?",
    summary: "Three ways to collect a payment, and when each one fits.",
    body: [
      p("Payment Links: a reusable, shareable URL built from a product's price. Best for a fixed-price item or service you want to sell without writing any code — share it anywhere."),
      p("Invoices: a one-off bill sent to a specific, named customer, with an optional due date. Best when you already know exactly who owes you and how much, outside a normal storefront flow."),
      p("Checkout API: you create a Checkout Session from your own backend with your API key and redirect the customer to the hosted checkout page yourself. Best when you have your own cart/order flow and just need PPay to handle collecting payment details."),
      p("All three end at the same place — a Checkout Session and, on success, a Transaction — so refunds, webhooks, and reporting behave identically no matter which one a payment came through."),
    ],
  },
  {
    slug: "understanding-dashboard",
    category: "getting-started",
    title: "Understanding your dashboard",
    summary: "Where everything lives, and how it's all connected.",
    body: [
      p("Home gives you a live analytics snapshot. Balances shows available vs. pending funds and payout history. Transactions, Customers, Product catalog, and Billing (Invoices/Subscriptions) are your core records."),
      p("Every detail page — a transaction, a customer, a subscription — shows a \"Related\" panel linking straight to everything connected to it (the customer who paid, the payment link or invoice that generated it, the subscription it belongs to). You should rarely need to copy an ID and search for it manually."),
      p("Developers holds API Keys, Webhooks, Events (a full log of everything sent to your webhook endpoints), and this Documentation site."),
    ],
  },

  // Payments
  {
    slug: "test-cards-wallets",
    category: "payments",
    title: "How payments are authorized (test cards & wallets)",
    summary: "The magic numbers that always produce the same result.",
    body: [
      p("Sandbox authorization is deterministic: specific card and wallet numbers always produce the same outcome, so your testing is reproducible."),
      ul([
        "4242 4242 4242 4242 — always succeeds",
        "4000 0000 0000 0002 — insufficient funds",
        "4000 0000 0000 0069 — expired card",
        "4000 0000 0000 0119 — processing error",
        "0300 0000000 (wallet) — always succeeds",
        "0300 0000001 (wallet) — insufficient funds",
        "0300 0000002 (wallet) — times out, then fails",
      ]),
      p("Any other card number is treated as generic and succeeds. Bank transfers always succeed in sandbox today. Full reference: Developer Documentation → Testing."),
    ],
  },
  {
    slug: "refunding-a-payment",
    category: "payments",
    title: "Refunding a payment",
    summary: "Full refunds, instant in sandbox, with a webhook to match.",
    body: [
      p("Open any succeeded transaction and click Refund. Refunds are full-amount only (no partial refunds yet) and are instant in sandbox mode."),
      p("A transaction can only be refunded once, and only if it hasn't already been swept into a settlement batch — once settled, it's outside the refund window, the same way most real gateways lock a payout period."),
      p("A successful refund fires a charge.refunded webhook event to any endpoint subscribed to it."),
    ],
  },
  {
    slug: "why-payment-failed",
    category: "payments",
    title: "Why did a payment fail?",
    summary: "Reading a failure_reason and what your customer sees.",
    body: [
      p("Every failed transaction has a failure_reason: insufficient_funds, expired_card, processing_error, card_declined, or timeout. This is shown on the transaction detail page and included in the payment_intent.failed webhook."),
      p("A failed checkout session can be retried by the customer with a different payment method until the session expires (30 minutes from creation)."),
      p("For subscriptions specifically, a failed renewal follows a separate retry/dunning process — see \"What happens when a renewal payment fails.\""),
    ],
  },
  {
    slug: "payment-methods",
    category: "payments",
    title: "Payment methods we support",
    summary: "Card, wallet, and bank transfer — today.",
    body: [
      p("Checkout supports card payments, mobile wallets, and bank transfer. All three are simulated in sandbox and behave identically from an integration standpoint — same session lifecycle, same webhook events."),
      p("QR-code payment is modeled in the data layer for future use but isn't wired up to a working checkout flow yet."),
    ],
  },

  // Billing
  {
    slug: "how-subscriptions-work",
    category: "billing",
    title: "How subscription billing works",
    summary: "First payment, renewals, and the invoice trail behind every charge.",
    body: [
      p("A subscription is created against a recurring price. If the customer already has a saved card/wallet, PPay charges it immediately and the subscription activates. If not, they're sent a checkout link — paying it force-saves their payment method, since renewals need one on file."),
      p("Every billing cycle (the first charge and every renewal) generates a real Invoice under the hood with a billing_reason of subscription_first or subscription_cycle, so your billing history is always a full audit trail, not a black box."),
      p("Renewals run on an hourly sweep that finds every subscription whose current period has ended and attempts to charge it."),
    ],
  },
  {
    slug: "dunning",
    category: "billing",
    title: "What happens when a renewal payment fails (dunning)",
    summary: "Three attempts, then the subscription needs your attention.",
    body: [
      p("A failed renewal moves the subscription to past_due and increments its failed-attempt counter. After 3 total failed attempts, it moves to unpaid and stops retrying automatically — at that point it needs manual attention (contact the customer, or cancel)."),
      p("A successful charge at any point resets the counter and returns the subscription to active."),
      p("Each attempt fires an invoice.paid or invoice.payment_failed webhook, so you can build your own dunning emails/notifications on top of these events."),
    ],
  },
  {
    slug: "cancelling-subscription",
    category: "billing",
    title: "Cancelling a subscription",
    summary: "Immediately, or at the end of the paid-for period.",
    body: [
      p("From a subscription's detail page: \"Cancel now\" ends it immediately. \"Cancel at period end\" lets the customer keep access until the period they've already paid for runs out, then it cancels automatically on the next billing sweep — no further charge happens."),
    ],
  },
  {
    slug: "creating-invoices",
    category: "billing",
    title: "Creating and sending invoices",
    summary: "One-off bills to a named customer.",
    body: [
      p("From Billing → New invoice, enter a customer name/email, amount, description, and optional due date. It's created and sent immediately — there's no draft state."),
      p("The invoice gets a hosted pay page you can send directly. You can cancel an unpaid invoice at any time; a paid one can never be cancelled."),
    ],
  },

  // Payouts
  {
    slug: "fees",
    category: "payouts",
    title: "How fees are calculated",
    summary: "A flat percentage, deducted before you're paid out.",
    body: [
      p("Sandbox mode uses an illustrative 2.9% fee on every successful transaction, with no fixed per-transaction fee — this is a placeholder so your dashboard numbers look realistic, not a confirmed real-world price."),
      p("The fee is deducted from the gross amount to produce the net amount that's actually settled to you. Both figures are always visible on the transaction."),
    ],
  },
  {
    slug: "payout-schedule",
    category: "payouts",
    title: "When do I get paid? (payout schedule)",
    summary: "Daily, weekly, or monthly — set in Settings.",
    body: [
      p("Once a day, PPay batches the previous day's succeeded, unsettled transactions per merchant into a settlement. That settlement then waits out your chosen payout delay — 1 day for a daily schedule, 7 for weekly, 30 for monthly — before being marked as paid out."),
      p("Change your schedule under Settings → Payout. This is a simulation in sandbox — no real bank transfer happens — but the timing logic is the same shape a real payout would follow."),
    ],
  },
  {
    slug: "reading-balances",
    category: "payouts",
    title: "Reading your Balances page",
    summary: "Available vs. pending, and your payout history.",
    body: [
      p("Available is settled, paid-out funds. Pending is money from succeeded transactions that hasn't cleared your payout delay yet. The payout history table below shows every settlement batch with its status."),
    ],
  },

  // Account
  {
    slug: "team-roles",
    category: "account",
    title: "Team roles and permissions",
    summary: "Owner, Admin, Support, Analyst — what each can do.",
    body: [
      ul([
        "Owner — everything, including managing other members and API keys. Can't remove the last remaining Owner.",
        "Admin — everything an Owner can do except demoting/removing Owners.",
        "Support — full read access, plus refunds. Can't touch API keys, webhooks, team, or settings.",
        "Analyst — read-only everywhere.",
      ]),
    ],
  },
  {
    slug: "inviting-team-member",
    category: "account",
    title: "Inviting a team member",
    summary: "Owner/Admin only, via a one-time invite link.",
    body: [
      p("From Team → Invite, enter an email and choose a role. Since there's no email-sending infrastructure yet, PPay gives you a one-time invite link to send them yourself (the same way a newly created API key is shown to you exactly once)."),
    ],
  },
  {
    slug: "rotating-api-keys",
    category: "account",
    title: "Rotating or revoking an API key",
    summary: "Keys are shown once — plan for that.",
    body: [
      p("Create a new key from API Keys before revoking the old one, update your integration, then revoke the old key. A revoked key stops working immediately and can't be restored — create a new one instead."),
      p("If a key leaks (committed to a public repo, exposed in frontend code), revoke it immediately regardless of whether you have a replacement ready."),
    ],
  },
  {
    slug: "branding-checkout",
    category: "account",
    title: "Branding your checkout page",
    summary: "Logo and brand color, shown on every hosted payment page.",
    body: [
      p("Under Settings → Branding, set a logo URL and a brand color. Both appear on your checkout page, payment link pages, and invoice pay pages — the left panel is tinted with your brand color and shows your logo and business name."),
    ],
  },

  // Risk
  {
    slug: "disputes-roadmap",
    category: "risk",
    title: "Disputes and chargebacks",
    summary: "Not built yet — here's what that means today.",
    body: [
      p("There is no dispute/chargeback handling in the product yet — this is explicitly on the roadmap, not a hidden or partially-built feature. We'd rather say that plainly than fake a Disputes tab with no real data behind it."),
      p("The sidebar shows Disputes and PPR (PPay Risk Radar) marked \"Coming soon\" for exactly this reason."),
    ],
  },

  // Compliance
  {
    slug: "going-live",
    category: "compliance",
    title: "Going live: what we ask for and why",
    summary: "A human-reviewed KYC step, not a toggle.",
    body: [
      p("Go Live is a manual review process, modeled on what a Pakistani payment gateway actually needs to collect: business details, an account representative's CNIC and details, and payout bank details — not US-shaped fields like an EIN or SSN."),
      p("There's deliberately no code path that auto-approves this. Full field list and what happens after you submit: Developer Documentation → Go-live checklist."),
    ],
  },
  {
    slug: "sandbox-security",
    category: "compliance",
    title: "Data & security in sandbox mode",
    summary: "What is, and isn't, real data.",
    body: [
      p("Sandbox card and wallet numbers are never real payment credentials — they're a fixed, documented set of test values (see \"How payments are authorized\"). No real PAN, CVV, or bank credential is ever accepted or stored by this product today."),
      p("API keys are stored hashed, never in plaintext, and shown to you in full only once at creation. Webhook payloads are signed with HMAC-SHA256 so your endpoint can verify a delivery actually came from PPay."),
    ],
  },
];

export function searchArticles(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ARTICLES.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.body.some((block) => (block.type === "p" ? block.text.toLowerCase().includes(q) : block.items.some((i) => i.toLowerCase().includes(q))))
  );
}
