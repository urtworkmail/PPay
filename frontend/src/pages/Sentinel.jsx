import { ChartLineIcon, FingerprintIcon, ShieldIcon, WorkflowIcon } from "../components/Icons";

const CAPABILITIES = [
  {
    icon: ChartLineIcon,
    title: "Real-time risk scoring",
    body:
      "Every PaymentIntent gets scored 0–100 at authorization time, combining velocity (how often this card/wallet/device has been seen recently), amount deviation from the customer's own history, and rail-specific signals (e.g. a JazzCash/EasyPaisa number used across many unrelated merchant accounts in a short window).",
  },
  {
    icon: WorkflowIcon,
    title: "Custom rule builder",
    body:
      "Write your own rules in plain conditions — \"block if amount > PKR 50,000 and this is a first-time customer\", \"review if billing country doesn't match issuing bank country\" — without needing a developer. Rules run before the charge reaches a rail, so a blocked attempt never touches JazzCash/EasyPaisa/1Link at all.",
  },
  {
    icon: FingerprintIcon,
    title: "Device & network fingerprinting",
    body:
      "Flags checkout attempts from a device or IP already associated with prior disputes or declines on your account — surfaced as a risk factor on the payment detail view, not an automatic block, so you keep the final call.",
  },
  {
    icon: ShieldIcon,
    title: "Dispute-evidence assembly",
    body:
      "When a dispute opens, Sentinel automatically pulls together everything already on file for that PaymentIntent — the risk score at the time of charge, device signals, and prior order history for that customer — into the evidence packet you submit, per architecture spec §4.6.",
  },
];

export default function Sentinel() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Sentinel</h1>
        <span className="badge badge-pending">On the roadmap</span>
      </div>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 28, maxWidth: 640 }}>
        Sentinel is PPay's fraud and risk engine — built on top of the same <code>PaymentIntent</code> orchestrator
        every charge already flows through, so it can see every attempt across every rail without merchants wiring
        anything extra in. It is not live yet: this page describes exactly what it will do when it ships, not what it
        does today — we don't put a feature behind a dashboard link until it's real.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 28 }}>
        {CAPABILITIES.map((c) => (
          <div key={c.title} className="card" style={{ padding: 20 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "var(--color-accent-soft)",
                color: "var(--color-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <c.icon width={17} height={17} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6 }}>{c.title}</div>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.6 }}>{c.body}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 8 }}>Why "Sentinel," not disputes-as-a-feature</div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.65, maxWidth: 640 }}>
          Disputes (in the Payments group) are the reactive side — responding once a chargeback has already opened.
          Sentinel is the preventive side — catching risk signals before a charge is attempted at all. Both read from
          the same ledger and charge history; Sentinel is what feeds Disputes better evidence automatically once a
          dispute does happen.
        </p>
      </div>
    </div>
  );
}
