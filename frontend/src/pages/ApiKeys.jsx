import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatDate } from "../api/format";

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [newKey, setNewKey] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const data = await apiFetch("/merchants/me/api-keys");
      setKeys(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const key = await apiFetch("/merchants/me/api-keys", { method: "POST" });
      setNewKey(key.full_key);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id) {
    try {
      await apiFetch(`/merchants/me/api-keys/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>API Keys</h1>
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            Use a sandbox key to authenticate server-to-server calls to the PPay API.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? "Creating…" : "Create key"}
        </button>
      </div>

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {newKey && (
        <div
          className="card"
          style={{ padding: 18, marginBottom: 20, borderColor: "var(--color-accent)", background: "var(--color-accent-soft)" }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Copy this key now — it won't be shown again</div>
          <code className="mono" style={{ fontSize: 13, wordBreak: "break-all" }}>
            {newKey}
          </code>
        </div>
      )}

      <div className="card">
        {keys.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>No API keys yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="mono">{k.key_prefix}_••••••••</td>
                  <td style={{ textTransform: "capitalize" }}>{k.mode}</td>
                  <td>
                    <span className={`badge ${k.is_active ? "badge-success" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>
                      {k.is_active ? "active" : "revoked"}
                    </span>
                  </td>
                  <td style={{ color: "var(--color-text-muted)" }}>{formatDate(k.created_at)}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>{formatDate(k.last_used_at)}</td>
                  <td>
                    {k.is_active && (
                      <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={() => handleRevoke(k.id)}>
                        Revoke
                      </button>
                    )}
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
