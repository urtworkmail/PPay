import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatMinorAmount } from "../api/format";
import { CopyIcon, PlusIcon } from "../components/Icons";
import Modal from "../components/Modal";

export default function PaymentLinks() {
  const [links, setLinks] = useState([]);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", amount: "" });

  async function load() {
    try {
      setLinks(await apiFetch("/payment-links"));
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
      await apiFetch("/payment-links", {
        method: "POST",
        body: {
          title: form.title,
          description: form.description || undefined,
          amount_minor: Math.round(parseFloat(form.amount) * 100),
        },
      });
      setForm({ title: "", description: "", amount: "" });
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeactivate(id) {
    try {
      await apiFetch(`/payment-links/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function copyLink(link) {
    navigator.clipboard?.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Payment Links</h1>
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            Share a link to get paid instantly — no website or integration required.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <PlusIcon width={15} height={15} /> New link
        </button>
      </div>

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        {links.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>
            No payment links yet. Create one to start collecting payments without any code.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Amount</th>
                <th>Uses</th>
                <th>Status</th>
                <th>Link</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.title}</div>
                    {l.description && (
                      <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{l.description}</div>
                    )}
                  </td>
                  <td>{formatMinorAmount(l.amount_minor, l.currency)}</td>
                  <td>{l.usage_count}</td>
                  <td>
                    <span className={`badge ${l.is_active ? "badge-success" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>
                      {l.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => copyLink(l)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "none",
                        border: "none",
                        color: "var(--color-accent)",
                        fontSize: 12.5,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <CopyIcon width={13} height={13} /> {copiedId === l.id ? "Copied!" : "Copy link"}
                    </button>
                  </td>
                  <td>
                    {l.is_active && (
                      <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={() => handleDeactivate(l.id)}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <Modal title="Create payment link" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Title
              <input
                required
                placeholder="Consulting session"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={{ marginTop: 6 }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Description (optional)
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ marginTop: 6 }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Amount (PKR)
              <input
                required
                type="number"
                min="1"
                step="0.01"
                placeholder="2500.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                style={{ marginTop: 6 }}
              />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={creating}>
                {creating ? "Creating…" : "Create link"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
