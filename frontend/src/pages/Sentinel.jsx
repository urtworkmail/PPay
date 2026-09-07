import { Link } from "react-router-dom";
import { ChartLineIcon, CheckIcon, FingerprintIcon, ShieldIcon, WorkflowIcon } from "../components/Icons";

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
