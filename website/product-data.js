/* ══════════════════════════════════════════════════════════════
   Product page content.

   One entry per product. Every claim here is checked against what
   is actually built — stats describe capabilities (how many signals,
   what the threshold is), never invented performance numbers, and
   there are no testimonials, because there are no customers yet.
   ══════════════════════════════════════════════════════════════ */

const PRODUCTS = {
  /* ─────────────────────────── PAYMENTS ─────────────────────── */
  checkout: {
    name: 'Checkout',
    category: 'Payments',
    mockup: 'checkout',
    hero: {
      title: 'A checkout page you don’t have to build',
      sub: 'Create a session server-side, hand your customer a hosted URL, and PPay collects card, wallet, or bank-transfer details on a page branded with your business name, logo, and colour.',
      marks: ['<span style="color:var(--success);">●</span> Live in sandbox', '{{ico:shield}} Sentinel-checked before authorization', '{{ico:refresh}} Safe to retry'],
    },
    valueProps: [
      { title: 'Three methods, one page', body: 'Card, wallet, and bank transfer on a single hosted page — your customer picks, you integrate once.' },
      { title: 'Never charge twice', body: 'A required idempotency key means a retried request returns the original session instead of creating a second charge.' },
      { title: 'Risk-checked first', body: 'Sentinel scores the attempt before authorization runs. A blocked attempt never reaches a payment rail at all.' },
      { title: 'Branded, not generic', body: 'Your business name, logo, and brand colour render on the checkout panel — no PPay-branded interstitial.' },
    ],
    featureRows: [
      {
        eyebrow: 'One integration',
        title: 'One POST, one hosted URL',
        sub: 'Redirect the customer to the returned checkout_url. That is the entire integration if you don’t want to build your own payment form.',
        bullets: [
          '<strong>Idempotency-Key is required</strong> — reuse your order id and a timed-out retry returns the original session, never a duplicate charge.',
          '<strong>Amounts in minor units</strong> so there is no floating-point rounding anywhere in the money path.',
          '<strong>Free-form metadata</strong> is echoed back on the transaction, so your order id follows the payment through settlement.',
        ],
        code: {
          label: 'create a checkout session',
          body: `<span style="color:var(--accent);">POST</span> /v1/checkout/sessions
Idempotency-Key: <span style="color:var(--success);">order-1029</span>

{
  <span style="color:var(--success);">"amount_minor"</span>: <span style="color:var(--pending);">150000</span>,
  <span style="color:var(--success);">"currency"</span>: <span style="color:var(--success);">"PKR"</span>,
  <span style="color:var(--success);">"customer_email"</span>: <span style="color:var(--success);">"buyer@example.com"</span>,
  <span style="color:var(--success);">"return_url"</span>: <span style="color:var(--success);">"https://shop.example/thanks"</span>,
  <span style="color:var(--success);">"metadata"</span>: { <span style="color:var(--success);">"order_id"</span>: <span style="color:var(--success);">"1029"</span> }
}`,
        },
      },
      {
        eyebrow: 'Lifecycle',
        title: 'A session can be paid exactly once',
        sub: 'Every state a payment attempt can be in is explicit, and the terminal states are genuinely terminal — no ambiguous half-paid session to reconcile later.',
        bullets: [
          '<strong>created → pending → succeeded</strong>, or <strong>failed</strong> if the authorization is declined.',
          '<strong>Expires after 30 minutes</strong> unpaid — 60 for a subscription renewal, 24 hours for an invoice.',
          '<strong>Paying twice returns 409</strong>, so a double-submitted form can’t produce two charges.',
        ],
        visual: 'subscription',
      },
    ],
    segments: {
      title: 'Built for businesses that sell online',
      sub: 'The same hosted page fits very different sales motions.',
      items: [
        { ico: 'store', title: 'Ecommerce stores', body: 'Send shoppers from your cart to a checkout that already handles card, JazzCash, Easypaisa, and bank transfer.', need: 'Needs: one integration, every method' },
        { ico: 'terminal', title: 'SaaS & software', body: 'Charge for a plan without building PCI-scoped card forms into your own product.', need: 'Needs: no PCI scope' },
        { ico: 'book', title: 'Education & edtech', body: 'Collect course or admission fees with a link you can put in an email, portal, or WhatsApp message.', need: 'Needs: works without an app' },
      ],
    },
    stats: [
      { num: '3', label: 'Payment methods on one page' },
      { num: '30 min', label: 'Before an unpaid session expires' },
      { num: '1', label: 'Charge per session, guaranteed' },
      { num: '0', label: 'PCI scope you take on' },
    ],
    related: [
      { href: 'payment-links.html', ico: 'link', title: 'Payment Links', body: 'The same checkout, reachable from a URL with no integration at all.' },
      { href: 'sentinel.html', ico: 'shield', title: 'Sentinel', body: 'The risk scoring that runs before every authorization.' },
      { href: 'analytics.html', ico: 'chart', title: 'Analytics', body: 'Success rate and payment-method breakdown for every session.' },
    ],
    cta: { title: 'Try Checkout in sandbox', body: 'Create a session with a test key and pay it with a deterministic test card — no real money, ever, in sandbox mode.' },
  },

  'payment-links': {
    name: 'Payment Links',
    category: 'Payments',
    mockup: 'paymentLink',
    hero: {
      title: 'Get paid without a website',
      sub: 'A hosted, shareable URL that takes a customer straight to checkout for a specific price. Send it on WhatsApp, put it in an Instagram bio, print it as a QR code — no integration, no code.',
      marks: ['<span style="color:var(--success);">●</span> Live in sandbox', '{{ico:card}} Built for WhatsApp selling', '{{ico:alert}} No code required'],
    },
    valueProps: [
      { title: 'Live in under a minute', body: 'Create a product with a price, click Create link, and you have a working payment page.' },
      { title: 'The amount can’t drift', body: 'A link copies its price and description at creation, so editing the price later never changes a link you already sent.' },
      { title: 'Reusable or one-off', body: 'One link can take a hundred payments, or you can deactivate it the moment a single sale is done.' },
      { title: 'You can see what worked', body: 'Every link tracks how many checkouts it created and how many distinct customers paid.' },
    ],
    featureRows: [
      {
        eyebrow: 'How it works',
        title: 'One price in, one link out',
        sub: 'Links are always built from a Product’s Price rather than a loose amount, which keeps every payment attached to something you can report on later.',
        bullets: [
          '<strong>Opening the link creates a fresh Checkout Session</strong> behind the scenes — the customer goes straight to payment, with no "click to continue" step.',
          '<strong>Deactivating stops new payments only</strong> — the transaction history a link produced stays exactly as it was.',
          '<strong>Every payment is traceable</strong> back through the link to the paying customer’s full profile.',
        ],
        code: {
          label: 'create a payment link',
          body: `<span style="color:var(--accent);">POST</span> /v1/payment-links

{
  <span style="color:var(--success);">"price_id"</span>: <span style="color:var(--success);">"b4f0e6a2-..."</span>
}

<span style="color:var(--text-faint);">// →</span>
{
  <span style="color:var(--success);">"url"</span>: <span style="color:var(--success);">"https://pay.ppay.silicatelabs.site/pay/lnk_8Kd"</span>,
  <span style="color:var(--success);">"usage_count"</span>: <span style="color:var(--pending);">0</span>
}`,
        },
      },
      {
        eyebrow: 'Reporting',
        title: 'Know which link actually sold',
        sub: 'A link is not a dead end — it is a tracked object with its own usage history, so you can tell a WhatsApp broadcast from an Instagram bio.',
        bullets: [
          '<strong>usage_count</strong> counts checkout sessions created from the link.',
          '<strong>A distinct-customer count</strong> separates repeat buyers from new ones.',
          '<strong>Open any link</strong> to see every transaction it produced, each linked to the customer who paid.',
        ],
        visual: 'analytics',
      },
    ],
    segments: {
      title: 'For selling where your customers already are',
      sub: 'Most sales in Pakistan start in a chat, not a checkout funnel.',
      items: [
        { ico: 'compass', title: 'Creators & freelancers', body: 'Send a client a link for a deposit or a finished project without building any kind of storefront.', need: 'Needs: no website at all' },
        { ico: 'store', title: 'Instagram & WhatsApp sellers', body: 'Turn a DM conversation into a paid order by pasting one link into the chat.', need: 'Needs: shareable in a message' },
        { ico: 'lifeBuoy', title: 'Nonprofits & donations', body: 'Put a single reusable link on a poster, a QR code, or a fundraising campaign page.', need: 'Needs: one link, many payers' },
      ],
    },
    stats: [
      { num: '0', label: 'Lines of code to get paid' },
      { num: '1 min', label: 'From price to working link' },
      { num: '∞', label: 'Payments a single link can take' },
      { num: '2', label: 'Metrics tracked per link' },
    ],
    related: [
      { href: 'checkout.html', ico: 'card', title: 'Checkout', body: 'The page a link sends your customer to.' },
      { href: 'invoicing.html', ico: 'invoice', title: 'Invoicing', body: 'When you know exactly who owes you and how much.' },
      { href: 'notifications.html', ico: 'bell', title: 'Notifications', body: 'Know the moment a link gets paid.' },
    ],
    cta: { title: 'Create your first link', body: 'No code, no website — a link is live the moment you create a product and a price.' },
  },

  invoicing: {
    name: 'Invoicing',
    category: 'Payments',
    mockup: 'invoice',
    hero: {
      title: 'Send a bill, get paid online',
      sub: 'A one-off invoice for a specific, named customer — auto-numbered, with a hosted pay link, live the moment you create it. No draft workflow standing between you and getting paid.',
      marks: ['<span style="color:var(--success);">●</span> Live in sandbox', '{{ico:list}} Auto-numbered', '{{ico:link}} Hosted pay link included'],
    },
    valueProps: [
      { title: 'Live immediately', body: 'An invoice is created in sent status with a working pay link — there is no draft state to remember to publish.' },
      { title: 'Paid invoices are final', body: 'A paid invoice can never be cancelled, so your records can’t be rewritten after the money moved.' },
      { title: 'Your notes, your footer', body: 'A footer you control renders on every invoice — bank details, terms, or a thank-you.' },
      { title: 'Same engine as subscriptions', body: 'Recurring billing generates real invoices through this exact pipeline. No separate, less-tested code path.' },
    ],
    featureRows: [
      {
        eyebrow: 'Lifecycle',
        title: 'Three states, nothing hidden',
        sub: 'An invoice is either awaiting payment, paid, or cancelled. There is no fourth ambiguous state to reconcile at month end.',
        bullets: [
          '<strong>sent</strong> — awaiting payment, hosted link is live.',
          '<strong>paid</strong> — the linked transaction is visible on the invoice itself.',
          '<strong>cancelled</strong> — you stopped it before payment; it can never be paid afterwards.',
        ],
        visual: 'invoice',
      },
      {
        eyebrow: 'Recurring',
        title: 'Every subscription cycle is a real invoice',
        sub: 'The first charge and every renewal generate an invoice under the hood, tagged with why it was created and which subscription it belongs to.',
        bullets: [
          '<strong>billing_reason</strong> is <code class="type">subscription_first</code> or <code class="type">subscription_cycle</code>.',
          '<strong>subscription_id</strong> points straight back at the subscription that produced it.',
          '<strong>Identical pay pipeline</strong> to a manually created invoice — one code path, one set of bugs.',
        ],
        visual: 'subscription',
      },
    ],
    segments: {
      title: 'For businesses that bill, not just sell',
      sub: 'When the customer is known and the amount is agreed in advance.',
      items: [
        { ico: 'clipboard', title: 'Professional services', body: 'Bill a client for work already delivered, with your terms in the invoice footer.', need: 'Needs: named customer, agreed amount' },
        { ico: 'box', title: 'Wholesale & B2B', body: 'Send a numbered invoice for a bulk order and let the buyer pay it online instead of by transfer.', need: 'Needs: auto-numbering, records' },
        { ico: 'idCard', title: 'Clinics & practices', body: 'Invoice a patient or an insurer after the appointment rather than collecting at the desk.', need: 'Needs: bill after service' },
      ],
    },
    stats: [
      { num: '0', label: 'Draft steps before it’s payable' },
      { num: '3', label: 'Invoice states, all explicit' },
      { num: '24 hr', label: 'Checkout window on an invoice' },
      { num: '1', label: 'Shared pipeline with subscriptions' },
    ],
    related: [
      { href: 'subscriptions.html', ico: 'refresh', title: 'Subscriptions', body: 'Invoices generated automatically, every cycle.' },
      { href: 'payment-links.html', ico: 'link', title: 'Payment Links', body: 'When you don’t need a named customer.' },
      { href: 'tax.html', ico: 'receipt', title: 'Tax', body: 'What you owe on the fees you were charged.' },
    ],
    cta: { title: 'Bill your first customer', body: 'An invoice is live and payable the moment you create it — no approval step, no draft state.' },
  },

  subscriptions: {
    name: 'Subscriptions',
    category: 'Payments',
    mockup: 'subscription',
    hero: {
      title: 'Recurring billing that retries for you',
      sub: 'Create a subscription against a recurring price. PPay charges the saved payment method every cycle, and when a renewal fails it retries on a schedule before giving up — rather than silently losing you the customer.',
      marks: ['<span style="color:var(--success);">●</span> Live in sandbox', '{{ico:refresh}} Automatic dunning', '{{ico:card}} Saved payment methods'],
    },
    valueProps: [
      { title: 'Dunning is built in', body: 'A failed renewal moves to past_due and retries. Three failures moves it to unpaid — it never silently disappears.' },
      { title: 'A saved method, guaranteed', body: 'The first invoice force-saves a payment method, because a subscription structurally cannot renew without one.' },
      { title: 'Cancel honestly', body: 'Cancel at period end and the customer keeps what they already paid for, instead of losing access instantly.' },
      { title: 'One billing sweep', body: 'An hourly job finds every subscription that is due. No per-subscription timers to drift out of sync.' },
    ],
    featureRows: [
      {
        eyebrow: 'Statuses',
        title: 'Five states, and the failure path is explicit',
        sub: 'Most billing bugs come from an unclear failure path. Every retry, and the point where retrying stops, is a real state you can query.',
        bullets: [
          '<strong>incomplete</strong> → waiting on the first payment. <strong>active</strong> → billing normally.',
          '<strong>past_due</strong> → a renewal failed and is being retried; <code class="type">failed_attempt_count</code> increments.',
          '<strong>unpaid</strong> after 3 failures — retrying stops, and a successful charge at any earlier point resets the counter.',
        ],
        visual: 'subscription',
      },
      {
        eyebrow: 'First charge',
        title: 'Two paths, depending on what’s on file',
        sub: 'Whether a customer already has a saved card decides whether they need to visit checkout at all.',
        bullets: [
          '<strong>No saved method</strong> → the subscription is created incomplete with a hosted checkout link, and activates once that first invoice is paid.',
          '<strong>Saved method on file</strong> → PPay charges it immediately off-session and the subscription is active right away.',
          '<strong>Sandbox-safe by construction</strong> — a saved method stores magic test digits, never anything resembling a real card number.',
        ],
        code: {
          label: 'create a subscription',
          body: `<span style="color:var(--accent);">POST</span> /v1/subscriptions

{
  <span style="color:var(--success);">"customer_email"</span>: <span style="color:var(--success);">"buyer@example.com"</span>,
  <span style="color:var(--success);">"price_id"</span>: <span style="color:var(--success);">"b4f0e6a2-..."</span>
}

<span style="color:var(--text-faint);">// → checkout_url set if no method on file,</span>
<span style="color:var(--text-faint);">//   otherwise status is ACTIVE immediately</span>`,
        },
      },
    ],
    segments: {
      title: 'For revenue that repeats',
      sub: 'Anything billed on a cycle rather than a single sale.',
      items: [
        { ico: 'terminal', title: 'SaaS & software', body: 'Monthly and yearly plans with retries when a customer’s card fails, instead of instant churn.', need: 'Needs: dunning that works' },
        { ico: 'refresh', title: 'Gyms & memberships', body: 'Recurring membership fees collected automatically rather than chased in person each month.', need: 'Needs: automatic collection' },
        { ico: 'box', title: 'Subscription boxes', body: 'Charge on a fixed cycle and keep shipping only while the subscription is genuinely active.', need: 'Needs: clear active/unpaid state' },
      ],
    },
    stats: [
      { num: '3', label: 'Retry attempts before giving up' },
      { num: '5', label: 'Subscription states, all queryable' },
      { num: 'Hourly', label: 'Billing sweep for due renewals' },
      { num: '1', label: 'Invoice generated per cycle' },
    ],
    related: [
      { href: 'invoicing.html', ico: 'invoice', title: 'Invoicing', body: 'Every cycle produces a real invoice.' },
      { href: 'notifications.html', ico: 'bell', title: 'Notifications', body: 'Get told the moment a renewal fails.' },
      { href: 'analytics.html', ico: 'chart', title: 'Analytics', body: 'Watch renewal success rate over time.' },
    ],
    cta: { title: 'Set up recurring billing', body: 'Sandbox test cards let you force a successful renewal or a failing one, and watch dunning happen in real time.' },
  },

  /* ────────────────────── RISK & COMPLIANCE ─────────────────── */
  sentinel: {
    name: 'Sentinel',
    category: 'Risk & compliance',
    mockup: 'sentinel',
    hero: {
      title: 'Fraud scoring on every checkout attempt',
      sub: 'Six deterministic signals combine into a 0–100 score, checked before any payment rail is called. A blocked attempt never reaches authorization — the same guarantee a real rail integration would give you.',
      marks: ['<span style="color:var(--success);">●</span> Live in sandbox', '{{ico:shield}} Blocks before authorization', '{{ico:search}} Every signal visible'],
    },
    valueProps: [
      { title: 'Blocks before the rail', body: 'A blocked attempt never touches an authorization call, so it can’t become a charge you have to refund.' },
      { title: 'No black box', body: 'Every flag that fired, and the raw score, are on the transaction’s detail page. You can always see why.' },
      { title: 'Deterministic, not guessed', body: 'Six explicit rules with published thresholds — not a model whose behaviour changes underneath you.' },
      { title: 'Honest about its limits', body: 'Device fingerprinting and custom rules aren’t built yet, and this page says so rather than implying otherwise.' },
    ],
    featureRows: [
      {
        eyebrow: 'Live today',
        title: 'Six signals, one transparent score',
        sub: 'Each signal is a published rule with a published threshold. Signals combine into a score, and 75 or higher blocks the attempt.',
        bullets: [
          '<strong>velocity_email</strong> — 4+ attempts from one email in 10 minutes. <strong>velocity_ip</strong> — 6+ from one IP.',
          '<strong>amount_deviation</strong> — more than 5× your own trailing average. <strong>first_time_customer</strong> — no prior success from this email.',
          '<strong>high_amount_first_time</strong> — both together, the classic pattern. <strong>recent_declines</strong> — 3+ failures in 30 minutes.',
        ],
        visual: 'sentinel',
      },
      {
        eyebrow: 'On a block',
        title: 'What actually happens when a score crosses 75',
        sub: 'A block is recorded as a real, inspectable outcome rather than a silently dropped request.',
        bullets: [
          '<strong>Recorded as failed</strong> with <code class="type">failure_reason: "blocked_by_fraud_rule"</code>.',
          '<strong>You’re notified at critical severity</strong>, which is on by default for email.',
          '<strong>The score and flags live on the transaction</strong> — no separate endpoint to poll for them.',
        ],
        code: {
          label: 'transaction.json (excerpt)',
          body: `{
  <span style="color:var(--success);">"status"</span>: <span style="color:var(--success);">"failed"</span>,
  <span style="color:var(--success);">"failure_reason"</span>: <span style="color:var(--success);">"blocked_by_fraud_rule"</span>,
  <span style="color:var(--success);">"risk_score"</span>: <span style="color:var(--pending);">82</span>,
  <span style="color:var(--success);">"risk_flags"</span>: [
    <span style="color:var(--success);">"velocity_email"</span>,
    <span style="color:var(--success);">"first_time_customer"</span>,
    <span style="color:var(--success);">"amount_deviation"</span>
  ]
}`,
        },
      },
      {
        eyebrow: 'No hidden weighting',
        title: 'The exact scoring math — this is the whole scorer',
        sub: 'Every signal adds a fixed number of points, capped at 100. No model, no learned weights, nothing that changes behind your back.',
        bullets: [
          '<strong>velocity_email</strong> +35 · <strong>recent_declines</strong> +30 · <strong>velocity_ip</strong> +25',
          '<strong>amount_deviation</strong> +20 · <strong>high_amount_first_time</strong> +15 (on top of amount_deviation, when the customer is also new)',
          '<strong>first_time_customer</strong> alone adds nothing — it only matters combined with an unusual amount.',
        ],
        code: {
          label: 'worked example',
          body: `<span style="color:var(--text-faint);">// first-time customer, bursty IP, 6× your average order:</span>
velocity_ip           <span style="color:var(--pending);">+25</span>
amount_deviation       <span style="color:var(--pending);">+20</span>
high_amount_first_time <span style="color:var(--pending);">+15</span>
                        <span style="color:var(--text-faint);">────</span>
                        <span style="color:var(--success);">60</span>

<span style="color:var(--text-faint);">// one more failed attempt from the same identity:</span>
recent_declines        <span style="color:var(--pending);">+30</span>
                        <span style="color:var(--text-faint);">────</span>
                        <span style="color:var(--danger);">90 → blocked (≥75)</span>`,
        },
      },
    ],
    segments: {
      title: 'For anyone taking card payments from strangers',
      sub: 'Fraud pressure looks different depending on what you sell.',
      items: [
        { ico: 'box', title: 'Digital goods & gaming', body: 'Instant-delivery products are the classic card-testing target — velocity signals catch the burst.', need: 'Needs: catch card testing' },
        { ico: 'store', title: 'High-value ecommerce', body: 'A first-time buyer placing an unusually large order is exactly what amount_deviation is for.', need: 'Needs: flag abnormal orders' },
        { ico: 'globe', title: 'Travel & ticketing', body: 'High ticket prices and instant fulfilment make chargebacks expensive — better to block first.', need: 'Needs: block before the rail' },
      ],
    },
    stats: [
      { num: '6', label: 'Signals scored on every attempt' },
      { num: '75', label: 'Score that blocks a payment' },
      { num: '0', label: 'Rails called on a blocked attempt' },
      { num: '100%', label: 'Of flags visible to you' },
    ],
    related: [
      { href: 'disputes.html', ico: 'scale', title: 'Disputes', body: 'The reactive side, when something gets through.' },
      { href: 'checkout.html', ico: 'card', title: 'Checkout', body: 'Where scoring runs, before authorization.' },
      { href: 'notifications.html', ico: 'bell', title: 'Notifications', body: 'Critical alerts the moment a block happens.' },
    ],
    cta: { title: 'Test Sentinel in sandbox', body: 'Use the test cards to intentionally trigger velocity and first-time-customer flags, and watch a block happen.' },
  },

  disputes: {
    name: 'Disputes',
    category: 'Risk & compliance',
    mockup: 'disputes',
    hero: {
      title: 'Respond to chargebacks from one place',
      sub: 'A dispute is a chargeback raised against one of your successful charges — the reactive side of risk. Sentinel is the preventive side, catching risk before a charge happens at all.',
      marks: ['<span style="color:var(--success);">●</span> Live in sandbox', '{{ico:refresh}} 7-day response clock', '{{ico:terminal}} Rehearsable in sandbox'],
    },
    valueProps: [
      { title: 'A visible deadline', body: 'The 7-day response clock is on the dispute itself, not buried in an email you might miss.' },
      { title: 'Evidence in one field', body: 'Submit your response directly against the dispute — no separate portal, no PDF attachments to chase.' },
      { title: 'Rehearse it first', body: 'A sandbox-only simulate endpoint lets you practise the whole flow before it happens with real money.' },
      { title: 'Told at critical severity', body: 'A new dispute fires a critical notification with the deadline attached, on by default for email.' },
    ],
    featureRows: [
      {
        eyebrow: 'Lifecycle',
        title: 'Four states, and the clock is one of them',
        sub: 'A dispute is never just "open" — it is either waiting on you, waiting on a decision, or resolved.',
        bullets: [
          '<strong>needs_response</strong> — just raised, and you have 7 days.',
          '<strong>under_review</strong> — you have submitted; it is being considered.',
          '<strong>won / lost</strong> — resolved. In sandbox these are manual outcomes, not automated guesses.',
        ],
        visual: 'disputes',
      },
      {
        eyebrow: 'Sandbox honesty',
        title: 'You can practise, but we won’t fake it',
        sub: 'There is no real card network in sandbox to raise a genuine chargeback, so there is a dedicated endpoint to rehearse the flow deterministically.',
        bullets: [
          '<strong>/disputes/simulate</strong> creates a practice dispute against one of your sandbox charges.',
          '<strong>It returns 403 on a live key</strong> — fabricating a dispute about real money would be dishonest.',
          '<strong>Same code path as a real dispute</strong>, so what you rehearse is what you will actually do.',
        ],
        code: {
          label: 'rehearse a dispute',
          body: `<span style="color:var(--accent);">POST</span> /v1/disputes/simulate
Authorization: Bearer <span style="color:var(--success);">sk_sandbox_...</span>

<span style="color:var(--text-faint);">// then respond to it:</span>
<span style="color:var(--accent);">POST</span> /v1/disputes/{id}/respond
{
  <span style="color:var(--success);">"evidence_text"</span>: <span style="color:var(--success);">"Tracking number attached."</span>
}`,
        },
      },
    ],
    segments: {
      title: 'For businesses where a chargeback really costs',
      sub: 'The higher the ticket, the more a lost dispute hurts.',
      items: [
        { ico: 'store', title: 'Ecommerce & D2C', body: 'Respond with delivery evidence while the tracking record is still fresh and retrievable.', need: 'Needs: fast evidence submission' },
        { ico: 'globe', title: 'Travel & ticketing', body: 'High-value bookings attract "I didn’t authorise this" claims long after the trip.', need: 'Needs: a visible deadline' },
        { ico: 'terminal', title: 'SaaS & digital', body: 'Prove account access and usage against a claim that nothing was delivered.', need: 'Needs: one place to respond' },
      ],
    },
    stats: [
      { num: '7 days', label: 'To submit your response' },
      { num: '4', label: 'Dispute states, all explicit' },
      { num: '403', label: 'On simulating a live dispute' },
      { num: '1', label: 'Place to respond from' },
    ],
    related: [
      { href: 'sentinel.html', ico: 'shield', title: 'Sentinel', body: 'Block risky attempts before they become disputes.' },
      { href: 'notifications.html', ico: 'bell', title: 'Notifications', body: 'Never miss a response deadline.' },
      { href: 'analytics.html', ico: 'chart', title: 'Analytics', body: 'Track refund and dispute rates over time.' },
    ],
    cta: { title: 'Rehearse a dispute in sandbox', body: 'Simulate a chargeback and practise a response before it ever happens for real.' },
  },

  tax: {
    name: 'Tax',
    category: 'Risk & compliance',
    mockup: 'tax',
    hero: {
      title: 'Pakistani sales tax, computed properly',
      sub: 'Two structurally different figures, computed separately: Sales Tax on Services owed on PPay’s own platform fee, and your estimated withholding tax exposure on gross volume.',
      marks: ['<span style="color:var(--success);">●</span> Live in sandbox', '{{ico:globe}} Province-aware', '{{ico:alert}} Estimates, not filing advice'],
    },
    valueProps: [
      { title: 'Provincial, like the law is', body: 'Pakistan taxes services provincially — there is no federal sales tax on services, and this reflects that.' },
      { title: 'Two separate figures', body: 'Sales tax on our fee and your withholding exposure on volume are different things, so they are never merged into one number.' },
      { title: 'Null, not a fake zero', body: 'Before you set a province or filer status, figures return null. The API doesn’t guess and call it data.' },
      { title: 'Configured once', body: 'Set your province and filer status in settings, and every subsequent report computes itself.' },
    ],
    featureRows: [
      {
        eyebrow: 'Coverage',
        title: 'Every provincial authority, named',
        sub: 'Each province runs its own revenue authority with its own rate. The report uses the one matching your registration.',
        bullets: [
          '<strong>Punjab</strong> — Punjab Revenue Authority (PRA). <strong>Sindh</strong> — Sindh Revenue Board (SRB).',
          '<strong>Khyber Pakhtunkhwa</strong> — KPRA. <strong>Balochistan</strong> — BRA.',
          '<strong>Islamabad Capital Territory</strong> — FBR.',
        ],
        visual: 'tax',
      },
      {
        eyebrow: 'What we won’t claim',
        title: 'PPay does not file or remit tax for you',
        sub: 'These are estimates computed from published provincial rates so you can plan. They are not a filing, and not advice.',
        bullets: [
          '<strong>Confirm current rates</strong> with your revenue authority or a tax advisor before filing anything.',
          '<strong>Filer status matters</strong> — set it, because the withholding estimate depends on it.',
          '<strong>The report is a starting point</strong> for your accountant, not a replacement for one.',
        ],
        code: {
          label: 'configure and fetch',
          body: `<span style="color:var(--accent);">PATCH</span> /v1/merchants/me/tax
{
  <span style="color:var(--success);">"tax_province"</span>: <span style="color:var(--success);">"sindh"</span>,
  <span style="color:var(--success);">"tax_filer_status"</span>: <span style="color:var(--success);">"filer"</span>
}

<span style="color:var(--accent);">GET</span> /v1/merchants/me/tax/summary?period_days=<span style="color:var(--pending);">365</span>`,
        },
      },
    ],
    segments: {
      title: 'For businesses that have to file',
      sub: 'Anyone registered with a provincial revenue authority.',
      items: [
        { ico: 'clipboard', title: 'Registered service businesses', body: 'Know what sales tax is owed on the platform fees you paid, before your accountant asks.', need: 'Needs: provincial accuracy' },
        { ico: 'store', title: 'Growing ecommerce', body: 'Track withholding exposure as volume grows rather than discovering it at year end.', need: 'Needs: exposure on volume' },
        { ico: 'terminal', title: 'SaaS & agencies', body: 'Filer status changes what you owe — set it once and stop recalculating by hand.', need: 'Needs: filer-aware estimates' },
      ],
    },
    stats: [
      { num: '5', label: 'Provincial authorities covered' },
      { num: '2', label: 'Figures, computed separately' },
      { num: 'null', label: 'Returned rather than a fake zero' },
      { num: '365d', label: 'Default reporting window' },
    ],
    related: [
      { href: 'balances-payouts.html', ico: 'bank', title: 'Balances & Payouts', body: 'Where the fee figure comes from.' },
      { href: 'analytics.html', ico: 'chart', title: 'Analytics', body: 'The volume your exposure is computed on.' },
      { href: 'invoicing.html', ico: 'invoice', title: 'Invoicing', body: 'The bills that generate that volume.' },
    ],
    cta: { title: 'Set your province', body: 'One PATCH request and the report starts computing itself against real sandbox volume.' },
  },

  /* ────────────────────── MONEY & INSIGHTS ──────────────────── */
  'balances-payouts': {
    name: 'Balances & Payouts',
    category: 'Money & insights',
    mockup: 'payouts',
    hero: {
      title: 'Know exactly what’s settling, and when',
      sub: 'A scheduled job groups the day’s succeeded transactions into a settlement batch — gross, PPay’s fee, and the net released to you — then pays out on the schedule you choose.',
      marks: ['<span style="color:var(--success);">●</span> Live in sandbox', '{{ico:refresh}} Daily, weekly, or monthly', '{{ico:receipt}} Itemised batches'],
    },
    valueProps: [
      { title: 'Batches are itemised', body: 'Every settlement lists the individual transactions it swept in, so a payout is never an unexplained lump sum.' },
      { title: 'Your payout rhythm', body: 'Daily, weekly, or monthly — the next sweep picks up your choice automatically.' },
      { title: 'Fees shown, not buried', body: 'Gross, fee, and net are three separate figures on every batch rather than one net number.' },
      { title: 'Verified destination only', body: 'Payouts go to a bank account that passed micro-deposit verification, not one merely typed in.' },
    ],
    featureRows: [
      {
        eyebrow: 'Settlement',
        title: 'Grouped nightly, released on your schedule',
        sub: 'This mirrors how a real gateway holds funds briefly before releasing them, so the behaviour you build against now is the behaviour you get later.',
        bullets: [
          '<strong>Yesterday’s unsettled succeeded transactions</strong> are grouped per merchant into one batch.',
          '<strong>Net = gross − fee</strong>, computed per batch and shown as three separate figures.',
          '<strong>Payout delay follows your schedule</strong> — 1 day for daily, 7 for weekly, 30 for monthly.',
        ],
        visual: 'payouts',
      },
      {
        eyebrow: 'Before money moves',
        title: 'The destination has to be proven first',
        sub: 'A payout account is not trusted just because someone typed the number in — it has to pass verification.',
        bullets: [
          '<strong>Micro-deposit verification</strong> proves you actually control the account.',
          '<strong>Changing the account number resets verification</strong> — a different account has proven nothing.',
          '<strong>Every payout raises a notification</strong>, on by default for email.',
        ],
        visual: 'financialConnections',
      },
    ],
    segments: {
      title: 'For anyone who needs cash flow they can predict',
      sub: 'Payout timing matters differently depending on the business.',
      items: [
        { ico: 'store', title: 'Retail & D2C', body: 'Daily payouts keep working capital moving during a busy sales period.', need: 'Needs: fast, frequent payouts' },
        { ico: 'users', title: 'Marketplaces', body: 'Itemised batches let you reconcile which seller each payment belonged to.', need: 'Needs: itemised reconciliation' },
        { ico: 'box', title: 'Logistics & wholesale', body: 'Monthly batching matches how larger invoices and terms actually settle.', need: 'Needs: batch-level records' },
      ],
    },
    stats: [
      { num: '3', label: 'Payout schedules to choose from' },
      { num: '3', label: 'Figures per batch: gross, fee, net' },
      { num: '1 day', label: 'Fastest settlement hold' },
      { num: '100%', label: 'Of batches itemised' },
    ],
    related: [
      { href: 'financial-connections.html', ico: 'plug', title: 'Financial Connections', body: 'Verify the account payouts go to.' },
      { href: 'analytics.html', ico: 'chart', title: 'Analytics', body: 'The volume behind every batch.' },
      { href: 'tax.html', ico: 'receipt', title: 'Tax', body: 'What you owe on the fees taken.' },
    ],
    cta: { title: 'Set your payout schedule', body: 'Choose daily, weekly, or monthly from settings — the next sweep picks it up automatically.' },
  },

  analytics: {
    name: 'Analytics',
    category: 'Money & insights',
    mockup: 'analytics',
    hero: {
      title: 'Trends, not just today’s number',
      sub: 'The same transaction data as your overview page, aggregated differently: daily trends, per-method success rates, an hourly histogram, and honest period-over-period comparisons.',
      marks: ['<span style="color:var(--success);">●</span> Live in sandbox', '{{ico:trendUp}} No reporting delay', '{{ico:alert}} Never a fake zero'],
    },
    valueProps: [
      { title: 'Same data, no delay', body: 'Not a separate warehouse on a nightly sync — the same transaction records, aggregated live.' },
      { title: 'Compared to what came before', body: 'Every window is compared against the immediately preceding window of equal length, automatically.' },
      { title: 'Per-method truth', body: 'Card, wallet, and bank transfer each get their own success rate, so a weak method can’t hide in an average.' },
      { title: 'Null means no data', body: 'A period with no transactions returns null, not 0%. "Nothing happened" and "everything failed" are different claims.' },
    ],
    featureRows: [
      {
        eyebrow: 'What you get',
        title: 'Four views of the same money',
        sub: 'One request returns the full picture for a window you choose, rather than four endpoints you have to stitch together.',
        bullets: [
          '<strong>Daily trends</strong> for success rate, average order value, and refund rate.',
          '<strong>Payment-method breakdown</strong> with a success rate per method.',
          '<strong>An hourly activity histogram</strong>, plus period-over-period comparison.',
        ],
        visual: 'analytics',
      },
      {
        eyebrow: 'A design decision',
        title: 'Why an empty day returns null',
        sub: 'Reporting tools routinely paper over missing data with zeros, which quietly turns "we have no information" into "performance was terrible".',
        bullets: [
          '<strong>A 0% success rate is a claim</strong> — that attempts happened and all of them failed.',
          '<strong>null is the honest answer</strong> when no attempts happened at all.',
          '<strong>The response shape keeps the distinction</strong>, so your own dashboards don’t have to guess.',
        ],
        code: {
          label: 'fetch analytics',
          body: `<span style="color:var(--accent);">GET</span> /v1/dashboard/payments-analytics?period_days=<span style="color:var(--pending);">30</span>
Authorization: Bearer <span style="color:var(--success);">sk_sandbox_...</span>

<span style="color:var(--text-faint);">// a day with no attempts:</span>
{ <span style="color:var(--success);">"date"</span>: <span style="color:var(--success);">"2026-09-03"</span>, <span style="color:var(--success);">"success_rate"</span>: <span style="color:var(--pending);">null</span> }`,
        },
      },
    ],
    segments: {
      title: 'For teams making decisions from the numbers',
      sub: 'What you need out of analytics depends on what you are optimising.',
      items: [
        { ico: 'store', title: 'Ecommerce', body: 'Spot the hours you actually sell in, and which payment method is quietly failing.', need: 'Needs: hourly + per-method view' },
        { ico: 'terminal', title: 'SaaS', body: 'Watch renewal success rate trend rather than reading a single month in isolation.', need: 'Needs: period-over-period' },
        { ico: 'users', title: 'Marketplaces', body: 'Track average order value and refund rate as supply and demand shift.', need: 'Needs: AOV and refund trends' },
      ],
    },
    stats: [
      { num: '4', label: 'Aggregations in one request' },
      { num: '3', label: 'Payment methods broken out' },
      { num: '24', label: 'Hourly buckets per day' },
      { num: '0', label: 'Minutes of reporting delay' },
    ],
    related: [
      { href: 'balances-payouts.html', ico: 'bank', title: 'Balances & Payouts', body: 'Where this volume settles out.' },
      { href: 'sentinel.html', ico: 'shield', title: 'Sentinel', body: 'How many attempts were blocked, not just failed.' },
      { href: 'subscriptions.html', ico: 'refresh', title: 'Subscriptions', body: 'Renewal performance over time.' },
    ],
    cta: { title: 'See your trends', body: 'Every metric updates the moment a sandbox transaction completes — no nightly batch to wait for.' },
  },

  'financial-connections': {
    name: 'Financial Connections',
    category: 'Money & insights',
    mockup: 'financialConnections',
    hero: {
      title: 'Prove the payout account is really yours',
      sub: 'Micro-deposit verification — the same mechanism major payment platforms use for real ACH verification. Not a bank-aggregator integration, because none broadly exists to connect to for Pakistani banks yet.',
      marks: ['<span style="color:var(--success);">●</span> Live in sandbox', '{{ico:bank}} Micro-deposit based', '{{ico:shield}} Required before payout'],
    },
    valueProps: [
      { title: 'Control, not just knowledge', body: 'Knowing an account number proves nothing. Receiving two specific amounts in it proves you can see inside it.' },
      { title: 'Honest about the method', body: 'This is micro-deposits, not a bank API integration — and we say so instead of implying a connection that doesn’t exist.' },
      { title: 'Bounded attempts', body: 'Five confirmation attempts per verification, so the amounts can’t be brute-forced.' },
      { title: 'Resets when it must', body: 'Changing your payout account number resets verification automatically — the new account has proven nothing.' },
    ],
    featureRows: [
      {
        eyebrow: 'The flow',
        title: 'Start, wait, confirm',
        sub: 'Two small amounts are sent to the account. You read them off the account, and send them back.',
        bullets: [
          '<strong>In a live deployment</strong> the amounts appear on your real bank statement after 1–2 business days.',
          '<strong>In sandbox</strong> they arrive directly in your notification — there is no real bank behind a sandbox account to wait on.',
          '<strong>Confirming both amounts</strong> marks the account verified and unlocks payouts to it.',
        ],
        code: {
          label: 'start → confirm',
          body: `<span style="color:var(--accent);">POST</span> /v1/merchants/me/financial-connections/start

<span style="color:var(--text-faint);">// once you have the two amounts:</span>
<span style="color:var(--accent);">POST</span> /v1/merchants/me/financial-connections/confirm
{
  <span style="color:var(--success);">"amount_1"</span>: <span style="color:var(--pending);">20</span>,
  <span style="color:var(--success);">"amount_2"</span>: <span style="color:var(--pending);">3</span>
}`,
        },
      },
      {
        eyebrow: 'Why it gates payouts',
        title: 'The last check before money leaves',
        sub: 'A mistyped or maliciously changed account number is one of the cheapest ways to lose a payout. Verification is what stands in the way.',
        bullets: [
          '<strong>Payouts require a verified account</strong> — an unverified one simply can’t receive them.',
          '<strong>Changing the number resets it</strong>, so an attacker swapping the account still has to pass verification.',
          '<strong>Who can change it is a permissions question</strong> — see Team & Security.',
        ],
        visual: 'payouts',
      },
    ],
    segments: {
      title: 'For every business taking a payout',
      sub: 'The risk is the same regardless of size; the consequences aren’t.',
      items: [
        { ico: 'store', title: 'Small businesses', body: 'One mistyped digit sends a whole settlement to the wrong account. Verification catches it first.', need: 'Needs: catch typos before payout' },
        { ico: 'users', title: 'Marketplaces', body: 'Verify the destination before you start routing other people’s money through it.', need: 'Needs: proven destinations' },
        { ico: 'clipboard', title: 'Teams with shared access', body: 'When several people can edit settings, a reset-on-change rule is what stops a silent swap.', need: 'Needs: reset on change' },
      ],
    },
    stats: [
      { num: '2', label: 'Micro-deposit amounts sent' },
      { num: '5', label: 'Confirmation attempts allowed' },
      { num: '1–2 d', label: 'Real-world statement wait' },
      { num: 'Auto', label: 'Reset when the account changes' },
    ],
    related: [
      { href: 'balances-payouts.html', ico: 'bank', title: 'Balances & Payouts', body: 'Where a verified account gets used.' },
      { href: 'team-security.html', ico: 'users', title: 'Team & Security', body: 'Control who can change payout settings.' },
      { href: 'notifications.html', ico: 'bell', title: 'Notifications', body: 'Where the two amounts are delivered.' },
    ],
    cta: { title: 'Verify your payout account', body: 'Two amounts, one confirmation call — done in sandbox in seconds.' },
  },

  /* ─────────────────────────── PLATFORM ─────────────────────── */
  notifications: {
    name: 'Notifications',
    category: 'Platform',
    mockup: 'notifications',
    hero: {
      title: 'Know what happened, without polling for it',
      sub: 'Every audited change on your account — plus payments, refunds, disputes, and payouts — lands in your feed automatically. Webhooks are for your backend; notifications are for you.',
      marks: ['<span style="color:var(--success);">●</span> Live in sandbox', '{{ico:bell}} Per-category email control', '{{ico:shield}} Verified addresses only'],
    },
    valueProps: [
      { title: 'No subscription needed', body: 'Events appear in the dashboard feed automatically. You don’t configure anything to start seeing them.' },
      { title: 'Sensible defaults', body: 'Security, payout, team, and dispute emails are on by default — the ones you’d want to know about away from the dashboard.' },
      { title: 'Unverified means unmailed', body: 'An address that hasn’t been confirmed is never emailed, so a typo can’t leak your account activity.' },
      { title: 'Modes stay separate', body: 'Sandbox and live notifications are stored separately. Your testing never shows up as a live-mode alert.' },
    ],
    featureRows: [
      {
        eyebrow: 'Categories',
        title: 'Seven categories, each independently controlled',
        sub: 'Turn any category’s email on or off without losing it from the in-dashboard feed.',
        bullets: [
          '<strong>payment · refund · dispute · payout</strong> — the money events.',
          '<strong>security</strong> — a new-device sign-in, a password change, a revoked session.',
          '<strong>team · account</strong> — role changes, settings changes, and Go-Live decisions.',
        ],
        visual: 'notifications',
      },
      {
        eyebrow: 'Notifications vs webhooks',
        title: 'Two different audiences, on purpose',
        sub: 'Both exist because a person reading a dashboard and a server reacting to an event need genuinely different things.',
        bullets: [
          '<strong>Notifications are for humans</strong> — readable, categorised, and markable as read.',
          '<strong>Webhooks are for your backend</strong> — delivered independently, with a verifiable signature and retries.',
          '<strong>An alternate delivery address</strong> is confirmed by a one-time code before it is ever used.',
        ],
        code: {
          label: 'list unread notifications',
          body: `<span style="color:var(--accent);">GET</span> /v1/notifications?unread_only=<span style="color:var(--pending);">true</span>
Authorization: Bearer <span style="color:var(--success);">sk_sandbox_...</span>

<span style="color:var(--text-faint);">// mark everything read:</span>
<span style="color:var(--accent);">POST</span> /v1/notifications/read-all`,
        },
      },
    ],
    segments: {
      title: 'For the person who has to notice',
      sub: 'Different roles need to be told about different things.',
      items: [
        { ico: 'store', title: 'Owner-operators', body: 'One feed covering payments, payouts, and security, without watching a dashboard all day.', need: 'Needs: everything in one feed' },
        { ico: 'clipboard', title: 'Finance & ops teams', body: 'Payout and dispute emails on, payment noise off — so alerts stay meaningful.', need: 'Needs: per-category control' },
        { ico: 'terminal', title: 'Developers', body: 'Use webhooks for the backend and keep notifications for the humans reviewing it.', need: 'Needs: both, separately' },
      ],
    },
    stats: [
      { num: '7', label: 'Notification categories' },
      { num: '4', label: 'Emailed by default' },
      { num: '0', label: 'Setup steps to start receiving' },
      { num: '2', label: 'Modes, stored separately' },
    ],
    related: [
      { href: 'team-security.html', ico: 'users', title: 'Team & Security', body: 'Where security notifications originate.' },
      { href: 'disputes.html', ico: 'scale', title: 'Disputes', body: 'Critical alerts carrying your deadline.' },
      { href: 'developers.html', ico: 'key', title: 'Developers', body: 'Webhooks, for when a server needs to react.' },
    ],
    cta: { title: 'Configure your alerts', body: 'Turn any category on or off, and set an alternate delivery address, from Settings → Notifications.' },
  },

  'team-security': {
    name: 'Team & Security',
    category: 'Platform',
    mockup: 'teamSecurity',
    hero: {
      title: 'Give people access without giving away control',
      sub: 'Invite your team with a role that matches what they should be able to touch, require two-factor authentication, and see — and revoke — every device signed into your account.',
      marks: ['<span style="color:var(--success);">●</span> Live in sandbox', '{{ico:shield}} TOTP two-factor', '{{ico:card}} Per-device sessions'],
    },
    valueProps: [
      { title: 'Four real roles', body: 'Owner, Admin, Analyst, and Support — not a single "team member" role that can do everything.' },
      { title: 'App-based 2FA', body: 'TOTP from an authenticator app, not SMS codes that can be intercepted by a SIM swap.' },
      { title: 'Sessions are per-device', body: 'Every active session is bound to the device it was created on, and listed so you can see them all.' },
      { title: 'Revoke remotely', body: 'Revoke any session and that device is signed out on its very next request.' },
    ],
    featureRows: [
      {
        eyebrow: 'Roles',
        title: 'Access that matches the job',
        sub: 'Support staff handling refunds should not be able to change the bank account payouts go to. Roles make that structural rather than a policy people remember.',
        bullets: [
          '<strong>Owner</strong> — full control, including billing and account closure. <strong>Admin</strong> — settings, team, and payout configuration.',
          '<strong>Analyst</strong> — read access to transactions and analytics, no settings changes.',
          '<strong>Support</strong> — disputes and customer lookups only.',
        ],
        visual: 'teamSecurity',
      },
      {
        eyebrow: 'Sessions',
        title: 'You can see every device, and end any of them',
        sub: 'A stolen laptop or a shared login is only a problem for as long as its session stays valid.',
        bullets: [
          '<strong>Every session is device-bound</strong> — a stolen token alone doesn’t transfer to another machine.',
          '<strong>A new-device sign-in raises a security notification</strong>, on by default for email.',
          '<strong>Revocation takes effect on the next request</strong>, not at the end of some cache window.',
        ],
        visual: 'notifications',
      },
    ],
    segments: {
      title: 'For accounts more than one person touches',
      sub: 'The moment access is shared, roles stop being optional.',
      items: [
        { ico: 'clipboard', title: 'Agencies & services firms', body: 'Give an analyst read access to reporting without exposing payout settings.', need: 'Needs: read-only roles' },
        { ico: 'store', title: 'Growing ecommerce teams', body: 'Support staff handle disputes; only an admin can change where money lands.', need: 'Needs: separation of duties' },
        { ico: 'users', title: 'Marketplaces & platforms', body: 'Enforce 2FA across the team and audit which device did what.', need: 'Needs: 2FA + session audit' },
      ],
    },
    stats: [
      { num: '4', label: 'Distinct roles' },
      { num: 'TOTP', label: 'Two-factor method, not SMS' },
      { num: '1', label: 'Device bound per session' },
      { num: 'Instant', label: 'Effect of a session revocation' },
    ],
    related: [
      { href: 'notifications.html', ico: 'bell', title: 'Notifications', body: 'Security alerts on every sign-in.' },
      { href: 'financial-connections.html', ico: 'plug', title: 'Financial Connections', body: 'Control who can change payout accounts.' },
      { href: 'developers.html', ico: 'key', title: 'Developers', body: 'API keys are scoped to the account, not a user.' },
    ],
    cta: { title: 'Secure your account', body: 'Turn on two-factor authentication and invite your team with the right role from day one.' },
  },
};
