import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatMinorAmount } from "../api/format";
import Drawer from "../components/Drawer";
import { PlusIcon } from "../components/Icons";
import StatusBadge from "../components/StatusBadge";

function priceLabel(price) {
  const amount = formatMinorAmount(price.amount_minor, price.currency);
  const unit = price.interval_count > 1 ? `${price.interval_count} ${price.interval}s` : price.interval;
  return `${amount} / ${unit}`;
}

export default function Subscriptions() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ customer_email: "", customer_name: "", price_id: "" });

  const recurringPrices = products.flatMap((p) =>
    p.prices.filter((price) => price.is_active && price.interval !== "one_time").map((price) => ({ ...price, productName: p.name }))
  );

  async function load() {
    try {
      const [subs, prods] = await Promise.all([apiFetch("/subscriptions"), apiFetch("/products")]);
      setSubscriptions(subs);
      setProducts(prods);
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
      const created = await apiFetch("/subscriptions", {
        method: "POST",
        body: {
          customer_email: form.customer_email,
          customer_name: form.customer_name || undefined,
          price_id: form.price_id,
        },
      });
      setForm({ customer_email: "", customer_name: "", price_id: "" });
      setShowCreate(false);
      navigate(`/dashboard/subscriptions/${created.id}`, { state: { checkoutUrl: created.checkout_url } });
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
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Subscriptions</h1>
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            Recurring billing for your customers, charged automatically each cycle.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} disabled={recurringPrices.length === 0}>
          <PlusIcon width={15} height={15} /> New subscription
        </button>
      </div>

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {!loading && recurringPrices.length === 0 && (
        <div className="badge badge-pending" style={{ marginBottom: 16 }}>
          Create a product with a recurring price first (Product catalog → New product → Billing).
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : subscriptions.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>
            No subscriptions yet. Subscribe a customer to a recurring price to start billing them automatically.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Current period ends</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id} onClick={() => navigate(`/dashboard/subscriptions/${s.id}`)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.customer_name || s.customer_email}</div>
                    {s.customer_name && <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{s.customer_email}</div>}
                  </td>
                  <td>{priceLabel(s.price)}</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ color: "var(--color-text-muted)" }}>
                    {new Date(s.current_period_end).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <Drawer
          title="New subscription"
          subtitle="Bills the customer immediately if they have a saved payment method, otherwise sends them a checkout link."
          onClose={() => setShowCreate(false)}
        >
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Customer email
              <input
                required
                type="email"
                placeholder="customer@example.com"
                value={form.customer_email}
                onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                style={{ marginTop: 6 }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Customer name (optional)
              <input
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                style={{ marginTop: 6 }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Plan
              <select required value={form.price_id} onChange={(e) => setForm({ ...form, price_id: e.target.value })} style={{ marginTop: 6 }}>
                <option value="" disabled>
                  Select a recurring price
                </option>
                {recurringPrices.map((price) => (
                  <option key={price.id} value={price.id}>
                    {price.productName} — {priceLabel(price)}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={creating}>
                {creating ? "Creating…" : "Create subscription"}
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
