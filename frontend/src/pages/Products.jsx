import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatMinorAmount } from "../api/format";
import { PlusIcon } from "../components/Icons";
import Drawer from "../components/Drawer";

const INTERVALS = [
  { value: "one_time", label: "One time" },
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

function priceLabel(price) {
  const amount = formatMinorAmount(price.amount_minor, price.currency);
  if (price.interval === "one_time") return amount;
  const unit = price.interval_count > 1 ? `${price.interval_count} ${price.interval}s` : price.interval;
  return `${amount} / ${unit}`;
}

export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", amount: "", interval: "one_time" });

  async function load() {
    try {
      setProducts(await apiFetch("/products"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      await apiFetch("/products", {
        method: "POST",
        body: {
          name: form.name,
          description: form.description || undefined,
          price: {
            amount_minor: Math.round(parseFloat(form.amount) * 100),
            currency: "PKR",
            interval: form.interval,
            interval_count: 1,
          },
        },
      });
      setForm({ name: "", description: "", amount: "", interval: "one_time" });
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Product catalogue</h1>
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            The products and prices you sell. Used to build payment links and (soon) subscriptions.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <PlusIcon width={15} height={15} /> New product
        </button>
      </div>

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : products.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>
            No products yet. Create one to start building payment links and subscriptions around it.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Pricing</th>
                <th>Active subscriptions</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/dashboard/products/${p.id}`)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{p.description}</div>}
                  </td>
                  <td>
                    {p.prices
                      .filter((price) => price.is_active)
                      .map((price) => priceLabel(price))
                      .join(", ") || "—"}
                  </td>
                  <td>{p.active_subscriptions > 0 ? p.active_subscriptions : <span style={{ color: "var(--color-text-faint)" }}>0</span>}</td>
                  <td>
                    <span className={`badge ${p.is_active ? "badge-success" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>
                      {p.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <Drawer title="Create product" subtitle="Products power payment links and (soon) subscriptions." onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Name
              <input required placeholder="Pro Plan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Description (optional)
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Price (PKR)
              <input required type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ marginTop: 6 }} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Billing
              <select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} style={{ marginTop: 6 }}>
                {INTERVALS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={creating}>
                {creating ? "Creating…" : "Create product"}
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
