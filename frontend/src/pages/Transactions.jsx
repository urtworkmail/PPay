import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";

const STATUS_FILTERS = ["all", "succeeded", "failed", "pending", "refunded"];

export default function Transactions() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  async function load() {
    setLoading(true);
    const query = statusFilter === "all" ? "" : `&status=${statusFilter}`;
    try {
      const data = await apiFetch(`/transactions?page_size=50${query}`);
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleRefund() {
    setRefunding(true);
    try {
      await apiFetch(`/transactions/${refundTarget.id}/refund`, {
        method: "POST",
        body: { reason: refundReason || undefined },
      });
      setRefundTarget(null);
      setRefundReason("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefunding(false);
    }
  }

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

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

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
                <th></th>
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
                  <td>
                    {t.status === "succeeded" && !t.settled && (
                      <button
                        className="btn btn-danger"
                        style={{ padding: "5px 10px", fontSize: 12.5 }}
                        onClick={() => setRefundTarget(t)}
                      >
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {refundTarget && (
        <Modal title={`Refund ${formatMinorAmount(refundTarget.amount_minor, refundTarget.currency)}`} onClose={() => setRefundTarget(null)}>
          <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", marginBottom: 14 }}>
            This fully refunds transaction <span className="mono">{refundTarget.gateway_reference}</span>. In
            sandbox mode this is instant and simulated.
          </p>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Reason (optional)
            <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} style={{ marginTop: 6 }} />
          </label>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRefundTarget(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" style={{ flex: 1, borderColor: "var(--color-danger)" }} onClick={handleRefund} disabled={refunding}>
              {refunding ? "Refunding…" : "Confirm refund"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
