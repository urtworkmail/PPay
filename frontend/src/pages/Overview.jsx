import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import VolumeChart from "../components/VolumeChart";
import { useAuth } from "../context/AuthContext";

export default function Overview() {
  const { merchant } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [summaryData, txData] = await Promise.all([
          apiFetch("/dashboard/summary"),
          apiFetch("/transactions?page_size=100"),
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
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 20 }}>
        Your account is in sandbox mode — all transactions below use simulated payment rails.
      </p>

      {merchant?.live_status === "sandbox_only" && (
        <div
          className="card"
          style={{
            padding: "14px 18px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            background: "var(--color-accent-soft)",
            borderColor: "var(--color-accent)",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Ready to accept real payments?</div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Submit your business for verification to unlock live mode.
            </div>
          </div>
          <Link to="/dashboard/go-live" className="btn btn-primary" style={{ flexShrink: 0, textDecoration: "none" }}>
            Go Live
          </Link>
        </div>
      )}
      {merchant?.live_status === "pending_review" && (
        <div className="badge badge-pending" style={{ padding: "8px 14px", marginBottom: 24 }}>
          Your live access application is under review
        </div>
      )}
      {merchant?.live_status === "live" && (
        <div className="badge badge-success" style={{ padding: "8px 14px", marginBottom: 24 }}>
          Live payments enabled
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
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
        <StatCard label="Fees earned by PPay" value={formatMinorAmount(summary.total_fees_minor, "PKR")} />
        <StatCard
          label="Pending settlement"
          value={formatMinorAmount(summary.pending_settlement_minor, "PKR")}
          sublabel="Awaiting next settlement batch"
        />
      </div>

      <div className="card" style={{ padding: "20px 22px", marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 14 }}>Volume, last 14 days</div>
        <VolumeChart transactions={recent} />
      </div>

      <div className="card">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>
          Recent transactions
        </div>
        {recent.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>
            No transactions yet. Create a checkout session, payment link, or invoice to see it appear here.
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
              {recent.slice(0, 5).map((t) => (
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
