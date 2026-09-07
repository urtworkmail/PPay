import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatMinorAmount } from "../api/format";
import PageHeader from "../components/PageHeader";
import TrendChart from "../components/TrendChart";

const PERIODS = [
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

const METHOD_LABEL = { card: "Card", wallet: "Wallet", bank_transfer: "Bank transfer", unknown: "Unknown" };

function shortDate(d) {
  return new Date(d).toLocaleDateString("en-PK", { month: "short", day: "numeric" });
}

/** Turns a nullable RatePoint series into chart-safe {date, value} points —
 *  days with no data plot as 0 rather than breaking the chart, but the
 *  comparison headline above still reads "no data" honestly when nothing
 *  happened in a period at all. */
function toChartPoints(trend) {
  return trend.map((p) => ({ date: p.date, value: p.value ?? 0 }));
}

function ComparisonPill({ comparison, format = (v) => v }) {
  if (comparison.current_value === null || comparison.current_value === undefined) {
    return <span style={{ fontSize: 12, color: "var(--color-text-faint)" }}>No data this period</span>;
  }
  if (comparison.change_pct === null || comparison.change_pct === undefined) {
    return <span style={{ fontSize: 12, color: "var(--color-text-faint)" }}>No prior period to compare</span>;
  }
  const up = comparison.change_pct >= 0;
  return (
    <span style={{ fontSize: 12.5, fontWeight: 600, color: up ? "var(--color-success)" : "var(--color-danger)" }}>
      {up ? "↑" : "↓"} {Math.abs(comparison.change_pct)}%{" "}
      <span style={{ color: "var(--color-text-faint)", fontWeight: 500 }}>
        vs {format(comparison.previous_value)} last period
      </span>
    </span>
  );
}

function MetricCard({ title, value, comparison, format }) {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
        {comparison.current_value === null || comparison.current_value === undefined
          ? "—"
          : format(comparison.current_value)}
      </div>
      <ComparisonPill comparison={comparison} format={format} />
    </div>
  );
}

export default function Analytics() {
  const [periodDays, setPeriodDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/dashboard/payments-analytics?period_days=${periodDays}`)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [periodDays]);

  const money = (v) => formatMinorAmount(v ?? 0, data?.currency ?? "PKR");
  const pct = (v) => `${(v ?? 0).toFixed(1)}%`;

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Trends and comparisons behind your Overview snapshot."
        actions={
          <div style={{ display: "flex", gap: 6 }}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                className={p.value === periodDays ? "btn btn-primary" : "btn btn-secondary"}
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={() => setPeriodDays(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {error && <div className="badge badge-danger" style={{ marginBottom: 16, padding: "10px 12px" }}>{error}</div>}

      {!data ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 20 }}>
            <MetricCard title="Gross volume" comparison={data.gross_volume_comparison} format={money} />
            <MetricCard title="Transactions" comparison={data.transaction_count_comparison} format={(v) => Math.round(v)} />
            <MetricCard title="Success rate" comparison={data.success_rate_comparison} format={pct} />
            <MetricCard title="Average order value" comparison={data.average_order_value_comparison} format={money} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div className="card" style={{ padding: "18px 20px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Success rate</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 14 }}>
                Share of payment attempts that succeeded, per day.
              </div>
              <TrendChart
                points={toChartPoints(data.success_rate_trend)}
                formatValue={(v) => `${v.toFixed(1)}%`}
                formatDate={shortDate}
                color="var(--color-success)"
              />
            </div>
            <div className="card" style={{ padding: "18px 20px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Average order value</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 14 }}>
                Mean amount per successful payment, per day.
              </div>
              <TrendChart points={toChartPoints(data.average_order_value_trend)} formatValue={money} formatDate={shortDate} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, marginBottom: 20, alignItems: "start" }}>
            <div className="card" style={{ padding: "18px 20px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Refund rate</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 14 }}>
                Refunded amount as a share of gross volume, per day.
              </div>
              <TrendChart
                points={toChartPoints(data.refund_rate_trend)}
                formatValue={(v) => `${v.toFixed(1)}%`}
                formatDate={shortDate}
                color="var(--color-danger)"
              />
            </div>

            <div className="card" style={{ padding: "18px 20px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>By payment method</div>
              {data.method_breakdown.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>No payments in this period.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {data.method_breakdown.map((m) => (
                    <div key={m.method}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{METHOD_LABEL[m.method] ?? m.method}</span>
                        <span className="mono" style={{ color: "var(--color-text-muted)" }}>{money(m.amount_minor)}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: "var(--color-bg)", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${data.method_breakdown[0].amount_minor ? (m.amount_minor / data.method_breakdown[0].amount_minor) * 100 : 0}%`,
                            background: "var(--color-accent)",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--color-text-faint)", marginTop: 3 }}>
                        {m.count} attempt{m.count === 1 ? "" : "s"} · {m.success_rate === null ? "—" : `${m.success_rate}%`} success
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Activity by hour</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 14 }}>
              When payment attempts happen (UTC), across this period.
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
              {data.hourly_distribution.map((count, hour) => {
                const max = Math.max(...data.hourly_distribution, 1);
                return (
                  <div key={hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div
                      title={`${hour}:00 — ${count} attempt${count === 1 ? "" : "s"}`}
                      style={{
                        width: "100%",
                        height: Math.max(2, (count / max) * 70),
                        background: "var(--color-accent)",
                        opacity: count === 0 ? 0.15 : 0.85,
                        borderRadius: 2,
                      }}
                    />
                    {hour % 6 === 0 && (
                      <span style={{ fontSize: 9.5, color: "var(--color-text-faint)" }}>{hour}h</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
