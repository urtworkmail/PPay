import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate } from "../api/format";
import EventPayloadModal from "../components/EventPayloadModal";
import StatusBadge from "../components/StatusBadge";

const PAGE_SIZE = 25;

export default function Events() {
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/webhooks/events?page=${page}&page_size=${PAGE_SIZE}`)
      .then((data) => {
        setEvents(data);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Events</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24 }}>
        Every webhook-eligible event PPay has generated for your account, across all endpoints.
      </p>

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : events.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>No events yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Customer</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Response</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {events.map((log) => (
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
                  <td className="mono" style={{ fontSize: 12.5, color: "var(--color-text-muted)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.endpoint_url}
                  </td>
                  <td>
                    <StatusBadge status={log.status} />
                  </td>
                  <td style={{ color: "var(--color-text-muted)" }}>{log.response_status ?? "—"}</td>
                  <td style={{ color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{formatDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(page > 1 || hasMore) && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 13 }} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 13 }} disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}

      {selectedLog && <EventPayloadModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}
