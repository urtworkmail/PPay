import { Link } from "react-router-dom";
import CodeBlock from "../CodeBlock";
import { Callout, DocsTable, H2, P, Ul } from "../DocsKit";

export default function GettingStarted() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Getting started</h1>
      <P>
        PPay is a sandbox-first payment gateway built for the Pakistani market. Everything you build against this
        API — checkout, payment links, invoices, subscriptions, webhooks — runs on a deterministic sandbox engine
        today. Every card network, wallet, and bank rail is simulated; nothing here moves real money. That's stated
        everywhere in the product, not hidden in fine print.
      </P>

      <Callout tone="info">
        <strong>Sandbox by default.</strong> Every account starts in sandbox mode. Going live is a separate,
        explicit step — see the <Link to="/docs/go-live-checklist">Go-live checklist</Link>.
      </Callout>

      <H2 id="account">1. Create an account</H2>
      <P>
        <Link to="/register">Sign up</Link> with your business name, email, and password. This creates your
        <code className="mono"> Merchant</code> and an owner-level <code className="mono">User</code> in one step —
        you're immediately in sandbox mode with a working dashboard.
      </P>

      <H2 id="api-key">2. Get a sandbox API key</H2>
      <P>
        In the dashboard, go to <strong>Developers → API Keys</strong> and create a key. Keys look like{" "}
        <code className="mono">sk_sandbox_&lt;random&gt;</code> and are shown to you exactly once — copy it
        immediately. See <Link to="/docs/authentication">Authentication</Link> for how to use it.
      </P>

      <H2 id="first-payment">3. Take your first payment</H2>
      <P>
        A Checkout Session is the core primitive: you create one server-side with an amount, PPay gives you back a
        hosted checkout URL, and you send your customer there.
      </P>
      <CodeBlock
        label="Create a session, then open checkout_url in a browser"
        samples={{
          cURL: `curl https://api.ppay.dev/api/v1/checkout/sessions \\
  -X POST \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Idempotency-Key: order-1029" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount_minor": 150000,
    "currency": "PKR",
    "description": "Order #1029",
    "customer_email": "buyer@example.com"
  }'`,
          Python: `import requests

resp = requests.post(
    "https://api.ppay.dev/api/v1/checkout/sessions",
    headers={
        "Authorization": "Bearer sk_sandbox_...",
        "Idempotency-Key": "order-1029",
    },
    json={
        "amount_minor": 150000,
        "currency": "PKR",
        "description": "Order #1029",
        "customer_email": "buyer@example.com",
    },
)
session = resp.json()
print(session["checkout_url"])`,
          Node: `const resp = await fetch("https://api.ppay.dev/api/v1/checkout/sessions", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_sandbox_...",
    "Idempotency-Key": "order-1029",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount_minor: 150000,
    currency: "PKR",
    description: "Order #1029",
    customer_email: "buyer@example.com",
  }),
});
const session = await resp.json();
console.log(session.checkout_url);`,
        }}
      />
      <P>
        Amounts are always in minor units — paisas, not rupees (<code className="mono">150000</code> = Rs 1,500).
        Pay with the test card <code className="mono">4242 4242 4242 4242</code> (see{" "}
        <Link to="/docs/testing">Testing</Link>) and you'll land on a success screen.
      </P>

      <H2 id="two-integration-paths">Two ways to integrate</H2>
      <P>PPay mirrors the two integration shapes most gateways offer:</P>
      <DocsTable
        headers={["Path", "How it works", "When to use it"]}
        rows={[
          [
            "API + Checkout Sessions",
            "Your backend creates a Checkout Session with your API key, redirects the customer to the hosted checkout_url, and you get notified via webhook when it's paid.",
            "You have your own product/cart/order flow and just need PPay to handle taking the card details.",
          ],
          [
            "Payment Links",
            "Create a Product + Price once in the dashboard, generate a Payment Link from that price, and share the URL directly — no code required.",
            "Selling a single item, a service booking, or anything you'd rather not build checkout logic for.",
          ],
        ]}
      />
      <P>
        Both paths end at the same place — a Checkout Session and, on success, a Transaction — so everything else
        (webhooks, refunds, settlement) behaves identically regardless of which one you used.
      </P>

      <H2 id="whats-next">What's next</H2>
      <Ul
        items={[
          <>Read <Link to="/docs/checkout-sessions">Checkout Sessions</Link> for the full lifecycle (statuses, expiry, idempotency).</>,
          <>Set up a <Link to="/docs/webhooks">webhook endpoint</Link> so you know the moment a payment succeeds or fails.</>,
          <>If you're selling products, start with <Link to="/docs/products-and-prices">Products &amp; Prices</Link>.</>,
        ]}
      />
    </div>
  );
}
