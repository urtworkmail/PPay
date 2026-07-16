import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

export default function Webhooks() {
  const [endpoints, setEndpoints] = useState([]);
  const [url, setUrl] = useState("");
  const [newSecret, setNewSecret] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const data = await apiFetch("/webhooks/endpoints");
      setEndpoints(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const endpoint = await apiFetch("/webhooks/endpoints", {
        method: "POST",
        body: { url, events: ["payment_intent.succeeded", "payment_intent.failed"] },
      });
      setNewSecret(endpoint.secret);
      setUrl("");
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
        PPay sends <code className="mono">payment_intent.succeeded</code> and{" "}
        <code className="mono">payment_intent.failed</code> events, signed with HMAC, to your registered endpoints.
      </p>

      <form onSubmit={handleCreate} className="card" style={{ padding: 18, marginBottom: 20, display: "flex", gap: 10 }}>
        <input
          type="url"
          required
          placeholder="https://your-server.com/webhooks/openpay"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={creating} style={{ flexShrink: 0 }}>
          {creating ? "Adding…" : "Add endpoint"}
        </button>
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
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={ep.id}>
                  <td className="mono" style={{ wordBreak: "break-all" }}>{ep.url}</td>
                  <td style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{ep.events.join(", ")}</td>
                  <td>
                    <span className={`badge ${ep.is_active ? "badge-success" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>
                      {ep.is_active ? "active" : "disabled"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={() => handleDelete(ep.id)}>
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
