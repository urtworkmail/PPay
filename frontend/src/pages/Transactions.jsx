import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";

function exportCsv(items) {
  const header = ["id", "gateway_reference", "amount_minor", "currency", "fee_minor", "net_amount_minor", "status", "method", "created_at"];
  const rows = items.map((t) => [
    t.id,
    t.gateway_reference ?? "",
    t.amount_minor,
    t.currency,
    t.fee_minor,
    t.net_amount_minor,
    t.status,
    t.payment_method_details?.method ?? "",
    t.created_at,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const STATUS_FILTERS = ["all", "succeeded", "failed", "pending", "refunded"];

export default function Transactions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState(
    STATUS_FILTERS.includes(initialStatus) ? initialStatus : "all"
  );
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Transactions</h1>
        <button className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => exportCsv(items)} disabled={items.length === 0}>
          Export CSV
        </button>
      </div>
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
                <th>Customer</th>
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
                <tr key={t.id} onClick={() => navigate(`/dashboard/transactions/${t.id}`)} style={{ cursor: "pointer" }}>
                  <td className="mono">{t.gateway_reference ?? t.id.slice(0, 8)}</td>
                  <td>
                    {t.customer_email ? (
                      <Link
                        to={`/dashboard/customers/${encodeURIComponent(t.customer_email)}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "var(--color-accent)", textDecoration: "none" }}
                      >
                        {t.customer_email}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--color-text-faint)" }}>—</span>
                    )}
                  </td>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setRefundTarget(t);
                        }}
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
