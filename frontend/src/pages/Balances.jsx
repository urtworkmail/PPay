import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";

export default function Balances() {
  const [balance, setBalance] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiFetch("/balances/summary"), apiFetch("/settlements")])
      .then(([balanceData, settlementsData]) => {
        setBalance(balanceData);
        setSettlements(settlementsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Balances</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24 }}>
        Simulated payout pipeline. In sandbox mode no real bank transfer happens.
      </p>

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
            <StatCard
              label="Pending settlement"
              value={formatMinorAmount(balance.pending_settlement_minor, balance.currency)}
              sublabel="Succeeded payments not yet batched"
            />
            <StatCard
              label="Available for payout"
              value={formatMinorAmount(balance.available_minor, balance.currency)}
              sublabel={
                balance.next_payout_at
                  ? `Next payout ${formatDate(balance.next_payout_at)} · ${formatMinorAmount(balance.next_payout_amount_minor, balance.currency)}`
                  : "Nothing scheduled"
              }
            />
            <StatCard
              label="Paid out"
              value={formatMinorAmount(balance.paid_out_minor, balance.currency)}
              sublabel="All time"
            />
            <StatCard
              label="Payout schedule"
              value={<span style={{ textTransform: "capitalize" }}>{balance.payout_schedule}</span>}
              sublabel={
                <Link to="/dashboard/settings/payout" style={{ color: "var(--color-accent)" }}>
                  Manage in Settings
                </Link>
              }
            />
          </div>

          <div className="card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>
              Payout history
            </div>
            {settlements.length === 0 ? (
              <p style={{ padding: 20, color: "var(--color-text-muted)" }}>
                No settlements yet. Settlements are batched nightly for the previous day's succeeded transactions.
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Transactions</th>
                    <th>Gross</th>
                    <th>Fees</th>
                    <th>Net</th>
                    <th>Status</th>
                    <th>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s.id}>
                      <td style={{ color: "var(--color-text-muted)" }}>
                        {formatDate(s.period_start)} – {formatDate(s.period_end)}
                      </td>
                      <td>{s.transaction_count}</td>
                      <td>{formatMinorAmount(s.gross_amount_minor, "PKR")}</td>
                      <td style={{ color: "var(--color-text-muted)" }}>{formatMinorAmount(s.fee_amount_minor, "PKR")}</td>
                      <td style={{ fontWeight: 600 }}>{formatMinorAmount(s.net_amount_minor, "PKR")}</td>
                      <td>
                        <StatusBadge status={s.status} />
                      </td>
                      <td style={{ color: "var(--color-text-muted)" }}>{s.paid_at ? formatDate(s.paid_at) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
