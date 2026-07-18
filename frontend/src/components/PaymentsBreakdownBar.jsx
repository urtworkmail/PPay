import { formatMinorAmount } from "../api/format";

const STATUS_COLOR = {
  succeeded: "var(--color-accent)",
  failed: "var(--color-danger)",
  refunded: "var(--color-pending)",
  pending: "var(--color-text-faint)",
  authorizing: "var(--color-text-faint)",
};

const STATUS_LABEL = {
  succeeded: "Succeeded",
  failed: "Failed",
  refunded: "Refunded",
  pending: "Pending",
  authorizing: "Authorizing",
};

export default function PaymentsBreakdownBar({ breakdown, currency }) {
  const total = breakdown.reduce((sum, b) => sum + b.amount_minor, 0);

  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "var(--color-bg)", marginBottom: 16 }}>
        {total === 0 ? (
          <div style={{ flex: 1, background: "var(--color-border)" }} />
        ) : (
          breakdown.map((b) => (
            <div
              key={b.status}
              style={{
                width: `${(b.amount_minor / total) * 100}%`,
                background: STATUS_COLOR[b.status] ?? "var(--color-text-faint)",
              }}
            />
          ))
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {breakdown.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>No payments in this period.</div>
        ) : (
          breakdown.map((b) => (
            <div key={b.status} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[b.status] ?? "var(--color-text-faint)", flexShrink: 0 }} />
              <span style={{ color: "var(--color-text-muted)", flex: 1 }}>{STATUS_LABEL[b.status] ?? b.status}</span>
              <span style={{ fontWeight: 600 }}>{formatMinorAmount(b.amount_minor, currency)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
