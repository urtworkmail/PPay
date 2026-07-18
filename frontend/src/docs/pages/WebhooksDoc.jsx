import CodeBlock from "../CodeBlock";
import { Callout, DocsTable, H2, H3, P } from "../DocsKit";

export default function WebhooksDoc() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Webhooks</h1>
      <P>
        Webhooks are how PPay tells your backend that something happened — a payment succeeded, a subscription
        renewal failed — without you having to poll. Register an endpoint, pick which events it should receive, and
        PPay POSTs a signed JSON payload to it every time one of those events fires.
      </P>

      <H2 id="event-catalog">Event catalog</H2>
      <P>This is the complete list — every event this API is capable of emitting today:</P>
      <DocsTable
        headers={["Event", "Fires when"]}
        rows={[
          ["payment_intent.succeeded", "A checkout session was paid successfully."],
          ["payment_intent.failed", "A checkout session payment attempt failed."],
          ["charge.refunded", "A succeeded transaction was refunded."],
          ["invoice.paid", "A subscription billing-cycle invoice was paid (first charge or a renewal)."],
          ["invoice.payment_failed", "A subscription billing-cycle charge failed (feeds dunning)."],
        ]}
      />
      <P>
        Fetch this list programmatically at <code className="mono">GET /api/v1/webhooks/event-types</code> — no
        authentication required.
      </P>

      <H2 id="register">Register an endpoint</H2>
      <CodeBlock
        samples={{
          cURL: `curl https://api.ppay.dev/api/v1/webhooks/endpoints \\
  -X POST \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://yourserver.example.com/webhooks/ppay",
    "events": ["payment_intent.succeeded", "payment_intent.failed"]
  }'`,
        }}
      />
      <Callout tone="warn">
        The response includes a <code className="mono">secret</code> (format: <code className="mono">whsec_...</code>)
        shown <strong>once</strong>. Store it — you need it to verify signatures.
      </Callout>

      <H2 id="payload">Payload shape</H2>
      <CodeBlock
        samples={{
          JSON: `{
  "type": "payment_intent.succeeded",
  "data": {
    "transaction_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
    "checkout_session_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "amount_minor": 150000,
    "currency": "PKR",
    "status": "succeeded",
    "failure_reason": null
  }
}`,
        }}
      />

      <H2 id="verify">Verifying signatures</H2>
      <P>
        Every delivery includes a <code className="mono">PPay-Signature</code> header shaped like{" "}
        <code className="mono">t=1719500000,v1=5257a869...</code> — a Unix timestamp and an HMAC-SHA256 hex digest.
        The signed content is <code className="mono">&#123;timestamp&#125;.&#123;raw request body&#125;</code>, keyed with your
        endpoint's <code className="mono">whsec_...</code> secret. Always verify against the raw bytes you
        received, not a re-serialized copy — key ordering differences would break the signature.
      </P>
      <CodeBlock
        label="Verify a delivery"
        samples={{
          Python: `import hmac, hashlib

def verify_signature(raw_body: bytes, header: str, secret: str) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    timestamp, signature = parts["t"], parts["v1"]
    signed_content = f"{timestamp}.{raw_body.decode()}"
    expected = hmac.new(secret.encode(), signed_content.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

# Flask/FastAPI example:
# verify_signature(request.body, request.headers["PPay-Signature"], "whsec_...")`,
          Node: `const crypto = require("crypto");

function verifySignature(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const signedContent = \`\${parts.t}.\${rawBody}\`;
  const expected = crypto.createHmac("sha256", secret).update(signedContent).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

// Express: read the raw body (express.raw()), not the JSON-parsed one, before verifying.`,
        }}
      />

      <H3 id="retries">Delivery retries</H3>
      <P>
        If your endpoint doesn't respond with a 2xx status (or doesn't respond at all within 10 seconds), PPay
        retries up to <strong>5 times total</strong> with increasing backoff: 10s, 1m, 5m, 30m, then 2h after the
        previous attempt. After the 5th failed attempt, delivery is marked <code className="mono">failed</code> and
        stops — you can inspect and manually resend it from the dashboard's Webhooks page.
      </P>

      <H2 id="events-log">Events log</H2>
      <P>
        <strong>Developers → Events</strong> in the dashboard shows every event ever generated for your account,
        across all endpoints, with the customer it relates to and the delivery outcome — useful for debugging
        without needing your own logging on the receiving end yet.
      </P>
    </div>
  );
}
