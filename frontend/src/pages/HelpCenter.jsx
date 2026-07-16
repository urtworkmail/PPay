import { useState } from "react";
import { ExternalLinkIcon } from "../components/Icons";

const FAQS = [
  {
    q: "What is sandbox mode?",
    a: "Every PPay account starts in sandbox mode. Payments use simulated authorization (see Test Cards below) instead of real banks or card networks, so you can build and test your integration risk-free.",
  },
  {
    q: "How do I go live and accept real payments?",
    a: "Go to Go Live in the sidebar and submit your business details. A human reviews every application for compliance (KYC, settlement bank verification) before enabling live processing — this isn't automated, the same way PayFast, Stripe, and every licensed PSP works.",
  },
  {
    q: "What's the difference between Payment Links, Invoices, and the Checkout API?",
    a: "Payment Links are reusable, shareable links for a fixed amount (e.g. a product or service). Invoices (Billing) are one-off requests sent to a specific customer, with an optional due date. The Checkout API is for developers integrating payments directly into their own website or app.",
  },
  {
    q: "How do refunds work?",
    a: "From Transactions, you can fully refund any succeeded, unsettled transaction. Refunds are instant in sandbox mode and fire a charge.refunded webhook.",
  },
  {
    q: "What fees does PPay charge?",
    a: "Sandbox mode uses an illustrative 2.9% fee per successful transaction so your dashboard numbers look realistic. Real pricing will be confirmed when you go live.",
  },
];

const TEST_CARDS = [
  { value: "4242 4242 4242 4242", result: "Always succeeds" },
  { value: "4000 0000 0000 0002", result: "Declined — insufficient funds" },
  { value: "4000 0000 0000 0069", result: "Declined — expired card" },
  { value: "4000 0000 0000 0119", result: "Declined — processing error" },
];

const TEST_WALLETS = [
  { value: "0300 0000000", result: "Always succeeds" },
  { value: "0300 0000001", result: "Declined — insufficient funds" },
  { value: "0300 0000002", result: "Times out, then fails" },
];

const ROADMAP = [
  "Physical POS card readers (PayPOS-style)",
  "WooCommerce, Shopify & Magento plugins",
  "Recurring/subscription billing cycles",
  "Real RAAST, card network & wallet settlement (Go Live)",
];

function Accordion({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--color-border)" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "none",
          padding: "14px 20px",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          color: "var(--color-text)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        {q}
        <span style={{ color: "var(--color-text-faint)" }}>{open ? "−" : "+"}</span>
      </button>
      {open && <p style={{ padding: "0 20px 16px", margin: 0, fontSize: 13.5, color: "var(--color-text-muted)" }}>{a}</p>}
    </div>
  );
}

export default function HelpCenter() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Help Center</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 28 }}>
        Answers, sandbox test values, and how to reach us.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "start" }}>
        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>
              Frequently asked questions
            </div>
            {FAQS.map((f) => (
              <Accordion key={f.q} {...f} />
            ))}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Quick start (API)</div>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
              Create a checkout session with your sandbox key:
            </p>
            <pre
              className="mono"
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 14,
                fontSize: 12.5,
                overflowX: "auto",
              }}
            >
{`curl -X POST https://api.ppay.dev/api/v1/checkout/sessions \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Idempotency-Key: order-1234" \\
  -H "Content-Type: application/json" \\
  -d '{"amount_minor": 150000, "currency": "PKR"}'`}
            </pre>
          </div>
        </div>

        <div>
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Test cards</div>
            {TEST_CARDS.map((c) => (
              <div key={c.value} style={{ marginBottom: 8 }}>
                <div className="mono" style={{ fontSize: 13 }}>{c.value}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{c.result}</div>
              </div>
            ))}
            <div style={{ fontWeight: 600, margin: "16px 0 10px" }}>Test wallet numbers</div>
            {TEST_WALLETS.map((c) => (
              <div key={c.value} style={{ marginBottom: 8 }}>
                <div className="mono" style={{ fontSize: 13 }}>{c.value}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{c.result}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Contact support</div>
            <a href="mailto:support@ppay.dev" style={{ fontSize: 13.5, color: "var(--color-accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              support@ppay.dev <ExternalLinkIcon width={13} height={13} />
            </a>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>On the roadmap</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--color-text-muted)", display: "flex", flexDirection: "column", gap: 6 }}>
              {ROADMAP.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
