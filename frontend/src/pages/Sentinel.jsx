import { Link } from "react-router-dom";
import { ChartLineIcon, CheckIcon, FingerprintIcon, ShieldIcon, WorkflowIcon } from "../components/Icons";

// The real weights from services/fraud_engine.py — kept here as plain data,
// not prose, so this table can never drift from what the scorer actually
// does without someone noticing the numbers don't add up anymore.
const SCORING_RULES = [
  { flag: "velocity_email", points: 35, rule: "4+ attempts from the same email in 10 minutes" },
  { flag: "velocity_ip", points: 25, rule: "6+ attempts from the same IP in 10 minutes" },
  { flag: "amount_deviation", points: 20, rule: "More than 5× this merchant's own trailing average" },
  { flag: "high_amount_first_time", points: 15, rule: "amount_deviation and first_time_customer together — added on top of both" },
  { flag: "recent_declines", points: 30, rule: "3+ failed attempts from the same identity in 30 minutes" },
  { flag: "first_time_customer", points: 0, rule: "No prior succeeded transaction — recorded as a flag, scores nothing alone" },
];

const LIVE_CAPABILITIES = [
  {
    icon: ChartLineIcon,
    title: "Real-time risk scoring",
    body:
      "Every checkout attempt is scored 0–100 before it reaches a payment rail, combining velocity (how many attempts from this email or IP in the last 10 minutes), amount deviation from your own trailing average, first-time-customer status, and recent declines from the same identity — a card-testing pattern.",
  },
  {
    icon: ShieldIcon,
    title: "Block rules",
    body:
      "A score of 75 or higher is blocked automatically — the attempt never reaches sandbox_engine.authorize_*, the same guarantee a real rail integration would give you. You'll see the score and which signals fired on the transaction's detail page, and get notified when a block happens.",
  },
];

const ROADMAP_CAPABILITIES = [
  {
    icon: WorkflowIcon,
    title: "Custom rule builder",
    body:
      "Write your own rules in plain conditions — \"block if amount > PKR 50,000 and this is a first-time customer\", \"review if billing country doesn't match issuing bank country\" — without needing a developer. Today's block threshold is fixed (score ≥ 75), not user-configurable.",
  },
  {
    icon: FingerprintIcon,
    title: "Device & network fingerprinting",
    body:
      "Today's signals use IP address only. True device fingerprinting (browser/device identity that survives an IP change) would flag checkout attempts from a device already associated with prior disputes or declines on your account.",
  },
  {
    icon: ShieldIcon,
    title: "Dispute-evidence assembly",
    body:
      "When a dispute opens, automatically pull together everything already on file for that payment — the risk score at charge time, signals that fired, and prior order history for that customer — into the evidence you submit from the Disputes page.",
  },
];

function CapabilityCard({ c, live }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: live ? "var(--color-success-soft)" : "var(--color-accent-soft)",
            color: live ? "var(--color-success)" : "var(--color-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <c.icon width={17} height={17} />
        </div>
        <span className={`badge ${live ? "badge-success" : "badge-pending"}`}>{live ? "Live" : "Roadmap"}</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6 }}>{c.title}</div>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.6 }}>{c.body}</p>
    </div>
  );
}

export default function Sentinel() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Sentinel</h1>
        <span className="badge badge-success">Partially live</span>
      </div>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 12, maxWidth: 640 }}>
        Sentinel is PPay's fraud and risk engine. Risk scoring and block rules run on every checkout attempt today;
        the rest of this page describes what's still on the roadmap — we mark each capability accordingly rather than
        implying the whole thing is either fully live or entirely a mockup.
      </p>
      <p style={{ fontSize: 12.5, marginTop: 0, marginBottom: 28 }}>
        <Link to="/dashboard/transactions" style={{ color: "var(--color-accent)", fontWeight: 600 }}>
          See it on a real transaction →
        </Link>
      </p>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-faint)", marginBottom: 10 }}>
        <CheckIcon width={11} height={11} style={{ verticalAlign: -1, marginRight: 4 }} />
        Live now
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 28 }}>
        {LIVE_CAPABILITIES.map((c) => (
          <CapabilityCard key={c.title} c={c} live />
        ))}
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>Exactly how the score adds up</div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 16px", lineHeight: 1.6, maxWidth: 640 }}>
          Every signal that fires adds a fixed number of points to a 0–100 score, capped at 100. At{" "}
          <strong style={{ color: "var(--color-text)" }}>75 or higher</strong>, the attempt is blocked before
          authorization runs. No machine-learning model, no hidden weighting — this table is the entire scorer.
        </p>
        <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 2fr",
              gap: 12,
              padding: "9px 14px",
              background: "var(--color-bg)",
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--color-text-faint)",
            }}
          >
            <span>Flag</span>
            <span>Points</span>
            <span>Fires when</span>
          </div>
          {SCORING_RULES.map((r, i) => (
            <div
              key={r.flag}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 2fr",
                gap: 12,
                alignItems: "center",
                padding: "10px 14px",
                borderTop: i === 0 ? "none" : "1px solid var(--color-border)",
              }}
            >
              <span className="mono" style={{ fontSize: 12 }}>
                {r.flag}
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: r.points > 0 ? "var(--color-danger)" : "var(--color-text-faint)",
                  justifySelf: "start",
                  minWidth: 34,
                }}
              >
                {r.points > 0 ? `+${r.points}` : "—"}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{r.rule}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-faint)", margin: "12px 0 0", lineHeight: 1.5 }}>
          Worked example: a first-time customer, from an IP with 6+ attempts in the last 10 minutes, paying 6× your
          average order value — that's velocity_ip (25) + amount_deviation (20) + high_amount_first_time (15) = 60.
          Add one more failed attempt from the same identity in the last 30 minutes (recent_declines, +30) and the
          total crosses 75: blocked.
        </p>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-faint)", marginBottom: 10 }}>
        On the roadmap
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 28 }}>
        {ROADMAP_CAPABILITIES.map((c) => (
          <CapabilityCard key={c.title} c={c} live={false} />
        ))}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 8 }}>Why "Sentinel," not disputes-as-a-feature</div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.65, maxWidth: 640 }}>
          Disputes (in the Payments group) are the reactive side — responding once a chargeback has already opened.
          Sentinel is the preventive side — catching risk signals before a charge is attempted at all. Both read from
          the same transaction history; automatically feeding Sentinel's signals into a dispute's evidence is on the
          roadmap above, not built yet.
        </p>
      </div>
    </div>
  );
}
