import CodeBlock from "../CodeBlock";
import { Callout, DocsTable, H2, H3, P } from "../DocsKit";

export default function CheckoutSessions() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Checkout Sessions</h1>
      <P>
        A Checkout Session represents one attempt to collect a payment. You create it server-side with your API
        key, hand the customer a hosted <code className="mono">checkout_url</code>, and PPay handles collecting
        card/wallet/bank-transfer details on a page you don't have to build.
      </P>

      <H2 id="create">Create a session</H2>
      <CodeBlock
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
    "customer_email": "buyer@example.com",
    "customer_phone": "03001234567",
    "return_url": "https://yourshop.example.com/thank-you",
    "metadata": {"order_id": "1029"}
  }'`,
        }}
      />
      <DocsTable
        headers={["Field", "Required", "Notes"]}
        rows={[
          ["amount_minor", "yes", "Integer, minor units (paisas). Must be > 0."],
          ["currency", "no", "3-letter code, defaults to PKR."],
          ["description", "no", "Shown to the customer at checkout."],
          ["customer_email", "no", "If omitted, the checkout page collects it before payment."],
          ["customer_phone", "no", "—"],
          ["return_url", "no", "Where the customer is redirected ~1.8s after a successful payment."],
          ["metadata", "no", "Free-form JSON object, echoed back but not otherwise used."],
        ]}
      />

      <H3 id="idempotency">Idempotency</H3>
      <P>
        The <code className="mono">Idempotency-Key</code> header is <strong>required</strong> on session creation.
        Reuse the same key (e.g. your internal order id) if you retry a request after a timeout — PPay returns the
        original session instead of creating a duplicate, scoped per merchant. Reusing a key with different
        parameters returns <code className="mono">409 Conflict</code>.
      </P>

      <H2 id="lifecycle">Lifecycle & statuses</H2>
      <DocsTable
        headers={["Status", "Meaning"]}
        rows={[
          ["created", "Just created, no payment attempted yet."],
          ["pending", "A payment method was submitted and authorization is in flight."],
          ["succeeded", "Payment completed. A Transaction now exists for this session."],
          ["failed", "The authorization attempt was declined."],
          ["expired", "30 minutes passed with no successful payment (60 minutes for subscription renewals, 24 hours for invoices)."],
          ["cancelled", "Reserved for future explicit cancellation — not currently reachable via the API."],
        ]}
      />
      <Callout tone="warn">
        A session can be paid at most once. After <code className="mono">succeeded</code>, <code className="mono">failed</code>, or{" "}
        <code className="mono">expired</code>, calling pay again returns <code className="mono">409 Conflict</code>.
      </Callout>

      <H2 id="pay">Pay a session</H2>
      <P>
        This is the one call the hosted checkout page itself makes — you'd normally never call it directly, but the
        shape is useful if you're building a fully custom checkout UI against the API.
      </P>
      <CodeBlock
        samples={{
          cURL: `curl https://api.ppay.dev/api/v1/checkout/sessions/{session_id}/pay \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -d '{
    "method": "card",
    "card_number": "4242424242424242",
    "save_payment_method": true
  }'`,
        }}
      />
      <P>
        <code className="mono">method</code> is one of <code className="mono">card</code>,{" "}
        <code className="mono">wallet</code>, or <code className="mono">bank_transfer</code>. Card payments need{" "}
        <code className="mono">card_number</code>; wallet payments need <code className="mono">wallet_phone</code>. If
        the session doesn't already have a <code className="mono">customer_email</code> (e.g. it came from a Payment
        Link), pass one here — it gets attached to the session. See{" "}
        <code className="mono">save_payment_method</code> in the response of a subscription's first invoice under{" "}
        <a href="/docs/subscriptions">Subscriptions</a>.
      </P>

      <H2 id="get">Retrieve a session</H2>
      <CodeBlock samples={{ cURL: `curl https://api.ppay.dev/api/v1/checkout/sessions/{session_id}` }} />
      <P>No authentication required — this is what the hosted checkout page itself calls to render. The response includes a nested <code className="mono">merchant</code> object (business name, logo, brand color) used to render the branded checkout panel.</P>
    </div>
  );
}
