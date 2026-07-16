import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import { CopyIcon, PlusIcon } from "../components/Icons";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [form, setForm] = useState({ customerName: "", customerEmail: "", amount: "", description: "", dueDate: "" });

  async function load() {
    try {
      setInvoices(await apiFetch("/invoices"));
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
      await apiFetch("/invoices", {
        method: "POST",
        body: {
          customer_name: form.customerName || undefined,
          customer_email: form.customerEmail,
          amount_minor: Math.round(parseFloat(form.amount) * 100),
          description: form.description || undefined,
          due_date: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        },
      });
      setForm({ customerName: "", customerEmail: "", amount: "", description: "", dueDate: "" });
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleCancel(id) {
    try {
      await apiFetch(`/invoices/${id}/cancel`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function copyLink(inv) {
    navigator.clipboard?.writeText(inv.url);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Billing</h1>
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            Send a one-off invoice to a specific customer and get paid by card, wallet, or bank transfer.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <PlusIcon width={15} height={15} /> New invoice
        </button>
      </div>

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        {invoices.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>No invoices yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Amount</th>
                <th>Due</th>
                <th>Status</th>
                <th>Link</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.customer_name || inv.customer_email}</div>
                    <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{inv.customer_email}</div>
                  </td>
                  <td>{formatMinorAmount(inv.amount_minor, inv.currency)}</td>
                  <td style={{ color: "var(--color-text-muted)" }}>{inv.due_date ? formatDate(inv.due_date) : "—"}</td>
                  <td>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td>
                    {inv.url && (
                      <button
                        onClick={() => copyLink(inv)}
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
                        <CopyIcon width={13} height={13} /> {copiedId === inv.id ? "Copied!" : "Copy link"}
                      </button>
                    )}
                  </td>
                  <td>
                    {inv.status === "sent" && (
                      <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={() => handleCancel(inv.id)}>
                        Cancel
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
        <Modal title="Create invoice" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Customer name (optional)
              <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} style={{ marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Customer email
              <input
                required
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
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
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                style={{ marginTop: 6 }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Description (optional)
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Due date (optional)
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={{ marginTop: 6 }} />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={creating}>
                {creating ? "Sending…" : "Send invoice"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
