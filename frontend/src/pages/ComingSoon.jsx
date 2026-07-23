import { useParams } from "react-router-dom";
import { RocketIcon } from "../components/Icons";

const LABELS = {
  subscriptions: "Subscriptions",
  "payments-analytics": "Payments Analytics",
  disputes: "Disputes",
  "billing-overview": "Billing Overview",
  "usage-based": "Usage-based Billing",
  "revenue-recovery": "Revenue Recovery",
  reports: "Reports",
  metrics: "Metrics",
  "data-management": "Data Management",
  "data-analysis": "Data Analysis",
  profiles: "Profiles",
  tax: "Tax",
  identity: "Identity Verification",
  "financial-connections": "Financial Connections",
  workflows: "Workflows",
  issuing: "Issuing",
};

export default function ComingSoon() {
  const { slug } = useParams();
  const label = LABELS[slug] ?? "This feature";

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{label}</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24 }}>On our roadmap.</p>

      <div className="card" style={{ padding: 32, maxWidth: 480, textAlign: "center" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "var(--color-accent-soft)",
            color: "var(--color-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <RocketIcon width={20} height={20} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{label} is coming soon</div>
        <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", margin: 0 }}>
          We're building this out as part of the platform roadmap — it isn't wired up yet, so we're not going to
          pretend it is. Check back soon.
        </p>
      </div>
    </div>
  );
}
