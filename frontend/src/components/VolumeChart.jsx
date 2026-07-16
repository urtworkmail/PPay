import { useState } from "react";
import { formatMinorAmount } from "../api/format";

function buildDailySeries(transactions, days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({ date: d, amount: 0 });
  }

  const bucketByKey = new Map(buckets.map((b) => [b.date.toDateString(), b]));

  for (const t of transactions) {
    if (t.status !== "succeeded") continue;
    const d = new Date(t.created_at);
    d.setHours(0, 0, 0, 0);
    const bucket = bucketByKey.get(d.toDateString());
    if (bucket) bucket.amount += t.amount_minor;
  }

  return buckets;
}

export default function VolumeChart({ transactions, currency = "PKR" }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const buckets = buildDailySeries(transactions);
  const max = Math.max(...buckets.map((b) => b.amount), 1);

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          height: 140,
          borderBottom: "1px solid var(--color-border)",
          padding: "0 2px",
        }}
      >
        {buckets.map((b, i) => {
          const heightPx = Math.max((b.amount / max) * 128, b.amount > 0 ? 4 : 2);
          return (
            <div
              key={i}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
              style={{ flex: 1, display: "flex", justifyContent: "center", position: "relative", height: "100%", alignItems: "flex-end" }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 22,
                  height: heightPx,
                  borderRadius: "4px 4px 0 0",
                  background: b.amount > 0 ? "var(--color-accent)" : "var(--color-border)",
                  opacity: hoverIndex === null || hoverIndex === i ? 1 : 0.55,
                  transition: "opacity 0.1s ease",
                }}
              />
              {hoverIndex === i && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--color-text)",
                    color: "var(--color-bg)",
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "5px 8px",
                    borderRadius: 6,
                    whiteSpace: "nowrap",
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                >
                  {formatMinorAmount(b.amount, currency)}
                  <div style={{ fontWeight: 400, opacity: 0.75 }}>
                    {b.date.toLocaleDateString("en-PK", { month: "short", day: "numeric" })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>
          {buckets[0].date.toLocaleDateString("en-PK", { month: "short", day: "numeric" })}
        </span>
        <span style={{ fontSize: 11, color: "var(--color-text-faint)" }}>Today</span>
      </div>
    </div>
  );
}
