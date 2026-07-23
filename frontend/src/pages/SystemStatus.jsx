const COMPONENTS = [
  { name: "Dashboard", status: "operational" },
  { name: "Checkout & Payment Links", status: "operational" },
  { name: "REST API", status: "operational" },
  { name: "Webhooks", status: "operational" },
  { name: "Sandbox rail simulator", status: "operational" },
  { name: "Reconciliation job", status: "operational" },
];

const STATUS_LABEL = {
  operational: "Operational",
  degraded: "Degraded performance",
  outage: "Outage",
};

const STATUS_COLOR_VAR = {
  operational: "var(--color-success)",
  degraded: "var(--color-pending)",
  outage: "var(--color-danger)",
};

function StatusDot({ status }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: STATUS_COLOR_VAR[status] ?? STATUS_COLOR_VAR.operational,
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

export default function SystemStatus() {
  const allOperational = COMPONENTS.every((c) => c.status === "operational");

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>System Status</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24 }}>
        Current status and incident history for the PPay platform — the dashboard, API, checkout, and webhook
        delivery.
      </p>

      <div
        className="card"
        style={{
          padding: "16px 20px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: allOperational ? "var(--color-success-soft)" : "var(--color-pending-soft)",
          border: "none",
        }}
      >
        <StatusDot status={allOperational ? "operational" : "degraded"} />
        <span style={{ fontWeight: 700, fontSize: 14, color: allOperational ? "var(--color-success)" : "var(--color-pending)" }}>
          {allOperational ? "All systems operational" : "Some systems degraded"}
        </span>
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Components</div>
      <div className="card" style={{ marginBottom: 24 }}>
        {COMPONENTS.map((c) => (
          <div
            key={c.name}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 18px",
              borderBottom: "1px solid var(--color-border)",
              fontSize: 13.5,
            }}
          >
            <span>{c.name}</span>
            <span style={{ display: "flex", alignItems: "center", fontSize: 12.5, fontWeight: 600, color: STATUS_COLOR_VAR[c.status] }}>
              <StatusDot status={c.status} />
              {STATUS_LABEL[c.status]}
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Incident history</div>
      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>No incidents reported.</p>
      </div>
    </div>
  );
}
