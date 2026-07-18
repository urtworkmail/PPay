import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate } from "../api/format";

const DEFAULT_EVENTS = ["payment_intent.succeeded", "payment_intent.failed"];

export default function Webhooks() {
  const navigate = useNavigate();
  const [endpoints, setEndpoints] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState(DEFAULT_EVENTS);
  const [newSecret, setNewSecret] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const [endpointsData, eventTypesData] = await Promise.all([
        apiFetch("/webhooks/endpoints"),
        apiFetch("/webhooks/event-types"),
      ]);
      setEndpoints(endpointsData);
      setEventTypes(eventTypesData);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleEvent(type) {
    setSelectedEvents((prev) => (prev.includes(type) ? prev.filter((e) => e !== type) : [...prev, type]));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const endpoint = await apiFetch("/webhooks/endpoints", {
        method: "POST",
        body: { url, events: selectedEvents },
      });
      setNewSecret(endpoint.secret);
      setUrl("");
      setSelectedEvents(DEFAULT_EVENTS);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    try {
      await apiFetch(`/webhooks/endpoints/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Webhooks</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24 }}>
        PPay signs every event with HMAC and sends it to your registered endpoints for whichever events they're
        subscribed to — see <a href="/docs/webhooks" target="_blank" rel="noreferrer">the docs</a> for the full
        event catalog and how to verify signatures.
      </p>

      <form onSubmit={handleCreate} className="card" style={{ padding: 18, marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="url"
            required
            placeholder="https://your-server.com/webhooks/openpay"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={creating || selectedEvents.length === 0} style={{ flexShrink: 0 }}>
            {creating ? "Adding…" : "Add endpoint"}
          </button>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 8 }}>
            Events to send
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {eventTypes.map((et) => (
              <label
                key={et.type}
                title={et.description}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(et.type)}
                  onChange={() => toggleEvent(et.type)}
                  style={{ width: "auto" }}
                />
                <span className="mono">{et.type}</span>
              </label>
            ))}
          </div>
        </div>
      </form>

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {newSecret && (
        <div
          className="card"
          style={{ padding: 18, marginBottom: 20, borderColor: "var(--color-accent)", background: "var(--color-accent-soft)" }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Signing secret — copy it now, it won't be shown again</div>
          <code className="mono" style={{ fontSize: 13, wordBreak: "break-all" }}>
            {newSecret}
          </code>
        </div>
      )}

      <div className="card">
        {endpoints.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>No webhook endpoints registered.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Events</th>
                <th>Last delivery</th>
                <th>Failures (24h)</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={ep.id} onClick={() => navigate(`/dashboard/webhooks/${ep.id}`)} style={{ cursor: "pointer" }}>
                  <td className="mono" style={{ wordBreak: "break-all" }}>{ep.url}</td>
                  <td style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{ep.events.join(", ")}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>{ep.last_delivery_at ? formatDate(ep.last_delivery_at) : "—"}</td>
                  <td>
                    {ep.failure_count_24h > 0 ? (
                      <span className="badge badge-danger">{ep.failure_count_24h}</span>
                    ) : (
                      <span style={{ color: "var(--color-text-faint)" }}>0</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${ep.is_active ? "badge-success" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>
                      {ep.is_active ? "active" : "disabled"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-danger"
                      style={{ padding: "5px 10px", fontSize: 12.5 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ep.id);
                      }}
                    >
                      Remove
                    </button>
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
