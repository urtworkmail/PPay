import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";

const STATUS_FILTERS = ["all", "needs_response", "under_review", "won", "lost"];

export default function Disputes() {
  const navigate = useNavigate();
  const { merchant } = useAuth();
  const isSandbox = merchant?.live_status !== "live";
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [needsResponse, setNeedsResponse] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const query = statusFilter === "all" ? "" : `&status=${statusFilter}`;
    try {
      const data = await apiFetch(`/disputes?page_size=50${query}`);
      setItems(data.items);
      setTotal(data.total);
      setNeedsResponse(data.needs_response);
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

  async function simulateDispute() {
    setSimulating(true);
    setError(null);
    try {
      const dispute = await apiFetch("/disputes/simulate", { method: "POST", body: {} });
      navigate(`/dashboard/disputes/${dispute.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Disputes"
        subtitle="Chargebacks raised against your payments and your response deadline."
        actions={
          isSandbox ? (
            <button className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: 13 }} onClick={simulateDispute} disabled={simulating}>
              {simulating ? "Simulating…" : "Simulate a dispute"}
            </button>
          ) : null
        }
      />

      {needsResponse > 0 && (
        <div className="badge badge-danger" style={{ marginBottom: 16, padding: "10px 12px", display: "block" }}>
          {needsResponse} dispute{needsResponse === 1 ? "" : "s"} awaiting your response.
        </div>
      )}
      {error && (
        <div className="badge badge-danger" style={{ marginBottom: 16, padding: "10px 12px", display: "block" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={s === statusFilter ? "btn btn-primary" : "btn btn-secondary"}
            style={{ padding: "6px 14px", fontSize: 13, textTransform: "capitalize" }}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : items.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center" }}>
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
              {statusFilter === "all" ? "No disputes." : "No disputes match this filter."}
            </p>
            {isSandbox && statusFilter === "all" && total === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--color-text-faint)", marginTop: 8 }}>
                Nothing to show yet — try "Simulate a dispute" against a sandbox payment.
              </p>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Amount</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Respond by</th>
                <th>Raised</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} onClick={() => navigate(`/dashboard/disputes/${d.id}`)} style={{ cursor: "pointer" }}>
                  <td className="mono">{d.gateway_reference ?? d.id.slice(0, 8)}</td>
                  <td>{formatMinorAmount(d.amount_minor, "PKR")}</td>
                  <td>{d.reason ?? "—"}</td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  <td style={{ color: "var(--color-text-muted)" }}>{d.evidence_due_by ? formatDate(d.evidence_due_by) : "—"}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>{formatDate(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
