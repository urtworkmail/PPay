import CodeBlock from "../CodeBlock";
import { Callout, DocsTable, H2, P } from "../DocsKit";

export default function DisputesDoc() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Disputes</h1>
      <P>
        A dispute is a chargeback raised against one of your successful charges. This is the reactive side of risk
        — <a href="/docs/sentinel">Sentinel</a> is the preventive side, catching risk before a charge happens at all.
      </P>

      <H2 id="lifecycle">Lifecycle</H2>
      <DocsTable
        headers={["Status", "Meaning"]}
        rows={[
          ["needs_response", "Just raised — you have 7 days to submit evidence."],
          ["under_review", "You've submitted a response; it's being considered."],
          ["won", "Resolved in your favor (manual outcome, not automated in sandbox)."],
          ["lost", "Resolved against you (manual outcome, not automated in sandbox)."],
        ]}
      />

      <H2 id="respond">Respond to a dispute</H2>
      <CodeBlock
        samples={{
          cURL: `curl https://app.ppay.silicatelabs.site/api/v1/disputes/{id}/respond \\
  -X POST \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Content-Type: application/json" \\
  -d '{"evidence_text": "Customer received the product; tracking number attached."}'`,
        }}
      />

      <H2 id="simulate">Simulating a dispute in sandbox</H2>
      <P>
        There's no real card network in sandbox mode to raise a genuine chargeback against you, so there's a
        dedicated endpoint to rehearse the flow deterministically — the same idea as the sandbox's test cards.
      </P>
      <CodeBlock
        samples={{
          cURL: `curl https://app.ppay.silicatelabs.site/api/v1/disputes/simulate \\
  -X POST \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Content-Type: application/json" \\
  -d '{}'`,
        }}
      />
      <Callout tone="warn">
        <code className="mono">/disputes/simulate</code> only works in sandbox mode — calling it with a live API key
        returns <code className="mono">403</code>, since fabricating a dispute about real money would be dishonest.
      </Callout>

      <H2 id="notifications">Notifications</H2>
      <P>
        A new dispute fires a <code className="mono">critical</code>-severity notification (on by default for
        email) with the response deadline. See <a href="/docs/notifications">Notifications</a>.
      </P>
    </div>
  );
}
