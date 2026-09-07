import { Callout, DocsTable, H2, P } from "../DocsKit";

export default function SentinelDoc() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Sentinel</h1>
        <span className="badge badge-success">Partially live</span>
      </div>
      <P>
        Sentinel is PPay's fraud and risk engine. Every checkout attempt is scored before it reaches a payment rail
        — a blocked attempt never touches <code className="mono">sandbox_engine.authorize_*</code>, the same
        guarantee a real rail integration would give you.
      </P>

      <H2 id="signals">Signals (live today)</H2>
      <DocsTable
        headers={["Flag", "What it means"]}
        rows={[
          ["velocity_email", "4+ attempts from the same email in the last 10 minutes."],
          ["velocity_ip", "6+ attempts from the same IP in the last 10 minutes."],
          ["first_time_customer", "No prior succeeded transaction from this email."],
          ["amount_deviation", "Amount is more than 5× this merchant's own trailing average."],
          ["high_amount_first_time", "amount_deviation and first_time_customer together — the classic pattern."],
          ["recent_declines", "3+ failed attempts from the same identity in the last 30 minutes."],
        ]}
      />

      <H2 id="blocking">Blocking</H2>
      <P>
        Signals combine into a 0–100 score. A score of <strong>75 or higher blocks the attempt</strong> before any
        rail is called — the transaction is recorded as <code className="mono">failed</code> with{" "}
        <code className="mono">failure_reason: "blocked_by_fraud_rule"</code>, and you're notified at{" "}
        <code className="mono">critical</code> severity. The score and every flag that fired are visible on the
        transaction's detail page.
      </P>

      <Callout tone="warn">
        The block threshold is fixed today, not configurable per-account — a custom rule builder ("block if amount
        &gt; X and first-time customer") is on the roadmap, not built yet.
      </Callout>

      <H2 id="roadmap">On the roadmap</H2>
      <P>
        A no-code custom rule builder, true device fingerprinting (today's signals use IP address only), and
        automatic dispute-evidence assembly (pulling the risk score and signals into a dispute response for you).
      </P>
    </div>
  );
}
