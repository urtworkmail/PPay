import CodeBlock from "../CodeBlock";
import { Callout, DocsTable, H2, H3, P } from "../DocsKit";

export default function SubscriptionsDoc() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Subscriptions</h1>
      <P>
        Real recurring billing: create a subscription against a recurring Price, PPay charges the customer's saved
        payment method on every cycle automatically, and handles failed renewals with a retry schedule (dunning)
        before giving up.
      </P>

      <H2 id="create">Create a subscription</H2>
      <CodeBlock
        samples={{
          cURL: `curl https://api.ppay.dev/api/v1/subscriptions \\
  -X POST \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_email": "buyer@example.com",
    "customer_name": "Buyer Name",
    "price_id": "b4f0e6a2-..."
  }'`,
        }}
      />
      <P>Two things can happen next, depending on whether this customer already has a saved card/wallet on file:</P>
      <DocsTable
        headers={["Customer has a saved method?", "What happens", "Response"]}
        rows={[
          ["No", "The subscription is created as INCOMPLETE and an invoice is generated with a hosted checkout link. It only activates once that first invoice is paid — and paying it force-saves the payment method, since a subscription structurally can't renew without one.", "checkout_url is set — send the customer there."],
          ["Yes", "PPay charges that saved method immediately (same off-session flow as a renewal) and activates the subscription on success.", "checkout_url is null; status is ACTIVE right away."],
        ]}
      />

      <H2 id="statuses">Statuses</H2>
      <DocsTable
        headers={["Status", "Meaning"]}
        rows={[
          ["incomplete", "Created, waiting on the first payment."],
          ["active", "Billing normally. current_period_end is when the next charge is due."],
          ["past_due", "A renewal charge failed; retrying (see Dunning below)."],
          ["unpaid", "Every retry attempt failed — the subscription needs manual intervention or cancellation."],
          ["canceled", "Cancelled, either immediately or at the end of the paid-for period."],
        ]}
      />

      <H3 id="dunning">Dunning (failed renewals)</H3>
      <P>
        When a renewal charge fails, <code className="mono">failed_attempt_count</code> increments and the
        subscription moves to <code className="mono">past_due</code>. After <strong>3</strong> failed attempts total, it
        moves to <code className="mono">unpaid</code> and stops retrying automatically. A successful charge at any
        point resets the counter and returns the subscription to <code className="mono">active</code>.
      </P>
      <Callout tone="info">
        Billing runs on an hourly scheduler job that finds every subscription whose <code className="mono">current_period_end</code> has passed and attempts to charge it — there's no per-subscription timer, it's a single sweep.
      </Callout>

      <H2 id="cancel">Cancelling</H2>
      <CodeBlock
        samples={{
          cURL: `curl https://api.ppay.dev/api/v1/subscriptions/{id}/cancel \\
  -X POST \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Content-Type: application/json" \\
  -d '{"at_period_end": true}'`,
        }}
      />
      <P>
        <code className="mono">at_period_end: true</code> lets the customer keep access until the period they already
        paid for ends, then cancels automatically on the next billing sweep. <code className="mono">false</code> (the
        default) cancels immediately.
      </P>

      <H2 id="saved-methods">Saved payment methods</H2>
      <P>
        A customer's saved card/wallet is sandbox-safe by construction — it stores the same kind of magic test
        digits described in <a href="/docs/testing">Testing</a>, never anything resembling a real card number. A
        customer opts in via the "Save this card" checkbox at checkout, or has one force-saved on a subscription's
        first payment.
      </P>
    </div>
  );
}
