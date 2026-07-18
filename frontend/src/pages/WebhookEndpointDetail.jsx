import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate } from "../api/format";
import { SectionCard } from "../components/DetailKit";
import EventPayloadModal from "../components/EventPayloadModal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

export default function WebhookEndpointDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [endpoint, setEndpoint] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [resending, setResending] = useState(false);

  async function load() {
    try {
      const [endpointData, logsData] = await Promise.all([
        apiFetch(`/webhooks/endpoints/${id}`),
        apiFetch(`/webhooks/endpoints/${id}/logs`),
      ]);
      setEndpoint(endpointData);
      setLogs(logsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleRemove() {
    try {
      await apiFetch(`/webhooks/endpoints/${id}`, { method: "DELETE" });
      navigate("/dashboard/webhooks");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleResend() {
    if (!selectedLog) return;
    setResending(true);
    try {
      const updated = await apiFetch(`/webhooks/logs/${selectedLog.id}/resend`, { method: "POST" });
      setSelectedLog(updated);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  }

  if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>;
  if (error && !endpoint) return <div className="badge badge-danger">{error}</div>;
  if (!endpoint) return null;

  return (
    <div>
      <PageHeader
        backTo="/dashboard/webhooks"
        title={
          <>
            <span className="mono" style={{ fontSize: 18 }}>{endpoint.url}</span>
            <span className={`badge ${endpoint.is_active ? "badge-success" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>
              {endpoint.is_active ? "active" : "disabled"}
            </span>
          </>
        }
        subtitle={endpoint.events.join(", ")}
        actions={
          <button className="btn btn-danger" onClick={handleRemove}>
            Remove endpoint
          </button>
        }
      />

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <SectionCard title="Delivery log">
        {logs.length === 0 ? (
          <p style={{ padding: 18, color: "var(--color-text-muted)" }}>No events delivered to this endpoint yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Customer</th>
                <th>Transaction</th>
                <th>Status</th>
                <th>Response</th>
                <th>Attempts</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} onClick={() => setSelectedLog(log)} style={{ cursor: "pointer" }}>
                  <td className="mono">{log.event_type}</td>
                  <td>
                    {log.customer_email ? (
                      <Link
                        to={`/dashboard/customers/${encodeURIComponent(log.customer_email)}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "var(--color-accent)", textDecoration: "none" }}
                      >
                        {log.customer_email}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--color-text-faint)" }}>—</span>
                    )}
                  </td>
                  <td>
                    {log.transaction_id ? (
                      <Link
                        to={`/dashboard/transactions/${log.transaction_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mono"
                        style={{ color: "var(--color-accent)", textDecoration: "none" }}
                      >
                        {log.transaction_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--color-text-faint)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={log.status} />
                  </td>
                  <td style={{ color: "var(--color-text-muted)" }}>{log.response_status ?? "—"}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>{log.attempt_count}</td>
                  <td style={{ color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{formatDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {selectedLog && (
        <EventPayloadModal log={selectedLog} onClose={() => setSelectedLog(null)} onResend={handleResend} resending={resending} />
      )}
    </div>
  );
}
