import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatMinorAmount } from "../api/format";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { formatDate } from "../api/format";

export default function Overview() {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [summaryData, txData] = await Promise.all([
          apiFetch("/dashboard/summary"),
          apiFetch("/transactions?page_size=5"),
        ]);
        if (!cancelled) {
          setSummary(summaryData);
          setRecent(txData.items);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="badge badge-danger">{error}</div>;
  if (!summary) return <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Overview</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 28 }}>
        Your account is in sandbox mode — all transactions below use simulated payment rails.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard
          label="Total volume"
          value={formatMinorAmount(summary.total_volume_minor, "PKR")}
          sublabel={`${summary.transaction_count} transactions`}
        />
        <StatCard
          label="Success rate"
          value={`${summary.success_rate}%`}
          sublabel={`${summary.succeeded_count} succeeded / ${summary.failed_count} failed`}
        />
        <StatCard label="Fees earned by OpenPay" value={formatMinorAmount(summary.total_fees_minor, "PKR")} />
        <StatCard
          label="Pending settlement"
          value={formatMinorAmount(summary.pending_settlement_minor, "PKR")}
          sublabel="Awaiting next settlement batch"
        />
      </div>

      <div className="card">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>
          Recent transactions
        </div>
        {recent.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>
            No transactions yet. Create a checkout session via the API to see it appear here.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.gateway_reference ?? t.id.slice(0, 8)}</td>
                  <td>{formatMinorAmount(t.amount_minor, t.currency)}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td style={{ color: "var(--color-text-muted)" }}>{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
