import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import StatusBadge from "../components/StatusBadge";

export default function Settlements() {
  const [settlements, setSettlements] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/settlements")
      .then(setSettlements)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Settlements</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24 }}>
        Simulated daily payout batches. In sandbox mode no real bank transfer happens.
      </p>

      {error && <div className="badge badge-danger">{error}</div>}

      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : settlements.length === 0 ? (
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
                <th>Net paid</th>
                <th>Status</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
