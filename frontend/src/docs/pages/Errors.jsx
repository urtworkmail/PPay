import CodeBlock from "../CodeBlock";
import { DocsTable, H2, P } from "../DocsKit";

export default function Errors() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Errors & idempotency</h1>
      <P>
        Errors are plain HTTP status codes with a JSON body. There's no proprietary error-code system to learn —
        check the status code, read <code className="mono">detail</code>.
      </P>

      <H2 id="shape">Error shape</H2>
      <CodeBlock
        samples={{
          JSON: `{
  "detail": "Checkout session not found"
}`,
        }}
      />
      <P>
        Validation errors (missing/malformed fields) return a 422 with a more structured{" "}
        <code className="mono">detail</code> array — one entry per invalid field:
      </P>
      <CodeBlock
        samples={{
          JSON: `{
  "detail": [
    {
      "loc": ["body", "amount_minor"],
      "msg": "Input should be greater than 0",
      "type": "greater_than"
    }
  ]
}`,
        }}
      />

      <H2 id="status-codes">Status codes you'll see</H2>
      <DocsTable
        headers={["Code", "Meaning", "Typical cause"]}
        rows={[
          ["400", "Bad request", "Invalid enum value (e.g. unknown payment method or billing interval), business-rule violation (e.g. a recurring price used for a Payment Link)."],
          ["401", "Unauthorized", "Missing/invalid API key, or an expired dashboard session token."],
          ["403", "Forbidden", "Authenticated, but your role doesn't allow this action (e.g. an Analyst trying to create an API key)."],
          ["404", "Not found", "The id doesn't exist, or doesn't belong to your account — PPay never distinguishes the two, to avoid leaking which ids exist."],
          ["409", "Conflict", "Reusing an idempotency key with different parameters; paying an already-paid/expired session; refunding an already-refunded or settled transaction."],
          ["422", "Unprocessable entity", "Request body failed schema validation."],
        ]}
      />

      <H2 id="idempotency">Idempotency</H2>
      <P>
        Checkout Session creation requires an <code className="mono">Idempotency-Key</code> header — see{" "}
        <a href="/docs/checkout-sessions">Checkout Sessions</a>. It's scoped per merchant: the same key from two
        different accounts is independent. Every other write endpoint is naturally idempotent by virtue of acting
        on a specific resource id (e.g. cancelling an already-cancelled invoice just 409s rather than double-firing
        side effects) or is safe to retry outright (refunds and payments check current status before acting).
      </P>
    </div>
  );
}
