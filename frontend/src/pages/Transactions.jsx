import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import StatusBadge from "../components/StatusBadge";

const STATUS_FILTERS = ["all", "succeeded", "failed", "pending"];

export default function Transactions() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = statusFilter === "all" ? "" : `&status=${statusFilter}`;
    apiFetch(`/transactions?page_size=50${query}`)
      .then((data) => {
        if (!cancelled) {
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Transactions</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24 }}>{total} total</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={s === statusFilter ? "btn btn-primary" : "btn btn-secondary"}
            style={{ padding: "6px 14px", fontSize: 13 }}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="badge badge-danger">{error}</div>}

      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>No transactions match this filter.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Amount</th>
                <th>Fee</th>
                <th>Net</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.gateway_reference ?? t.id.slice(0, 8)}</td>
                  <td>{formatMinorAmount(t.amount_minor, t.currency)}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>{formatMinorAmount(t.fee_minor, t.currency)}</td>
                  <td>{formatMinorAmount(t.net_amount_minor, t.currency)}</td>
                  <td style={{ textTransform: "capitalize", color: "var(--color-text-muted)" }}>
                    {t.payment_method_details?.method ?? "—"}
                  </td>
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
