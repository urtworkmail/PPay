import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import { PlusIcon } from "../components/Icons";
import Drawer from "../components/Drawer";
import PageHeader from "../components/PageHeader";

const INTERVALS = [
  { value: "one_time", label: "One time" },
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

function priceLabel(price) {
  if (price.interval === "one_time") return "One time";
  const unit = price.interval_count > 1 ? `Every ${price.interval_count} ${price.interval}s` : `Per ${price.interval}`;
  return unit;
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddPrice, setShowAddPrice] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ amount: "", interval: "one_time" });
  const [creatingLinkFor, setCreatingLinkFor] = useState(null);
  const [togglingPrice, setTogglingPrice] = useState(null);

  async function load() {
    try {
      setProduct(await apiFetch(`/products/${id}`));
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

  async function handleDeactivate() {
    try {
      await apiFetch(`/products/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddPrice(e) {
    e.preventDefault();
    setAdding(true);
    try {
      await apiFetch(`/products/${id}/prices`, {
        method: "POST",
        body: {
          amount_minor: Math.round(parseFloat(form.amount) * 100),
          currency: "PKR",
          interval: form.interval,
          interval_count: 1,
        },
      });
      setForm({ amount: "", interval: "one_time" });
      setShowAddPrice(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleTogglePrice(price) {
    setTogglingPrice(price.id);
    try {
      await apiFetch(`/products/${id}/prices/${price.id}`, { method: "PATCH", body: { is_active: !price.is_active } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingPrice(null);
    }
  }

  async function handleCreateLink(price) {
    setCreatingLinkFor(price.id);
    setError(null);
    try {
      const link = await apiFetch("/payment-links", { method: "POST", body: { price_id: price.id } });
      navigate(`/dashboard/payment-links/${link.id}`);
    } catch (err) {
      setError(err.message);
      setCreatingLinkFor(null);
    }
  }

  if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>;
  if (error && !product) return <div className="badge badge-danger">{error}</div>;
  if (!product) return null;

  return (
    <div>
      <PageHeader
        backTo="/dashboard/products"
        title={
          <>
            {product.name}
            <span className={`badge ${product.is_active ? "badge-success" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>
              {product.is_active ? "active" : "inactive"}
            </span>
          </>
        }
        subtitle={product.description}
        actions={
          product.is_active && (
            <button className="btn btn-danger" onClick={handleDeactivate}>
              Deactivate
            </button>
          )
        }
      />

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ fontWeight: 600 }}>Prices</div>
          <button className="btn btn-secondary" style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={() => setShowAddPrice(true)}>
            <PlusIcon width={12} height={12} /> Add price
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Amount</th>
              <th>Billing</th>
              <th>Active subscriptions</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {product.prices.map((price) => (
              <tr key={price.id}>
                <td style={{ fontWeight: 600 }}>{formatMinorAmount(price.amount_minor, price.currency)}</td>
                <td style={{ color: "var(--color-text-muted)" }}>{priceLabel(price)}</td>
                <td>
                  {price.active_subscriptions > 0 ? (
                    <Link to="/dashboard/subscriptions" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
                      {price.active_subscriptions}
                    </Link>
                  ) : (
                    <span style={{ color: "var(--color-text-faint)" }}>0</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${price.is_active ? "badge-success" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>
                    {price.is_active ? "active" : "inactive"}
                  </span>
                </td>
                <td style={{ color: "var(--color-text-muted)" }}>{formatDate(price.created_at)}</td>
                <td>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    {price.is_active && price.interval === "one_time" && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "5px 10px", fontSize: 12.5 }}
                        onClick={() => handleCreateLink(price)}
                        disabled={creatingLinkFor === price.id}
                      >
                        {creatingLinkFor === price.id ? "Creating…" : "Create link"}
                      </button>
                    )}
                    <button
                      className={price.is_active ? "btn btn-danger" : "btn btn-secondary"}
                      style={{ padding: "5px 10px", fontSize: 12.5 }}
                      onClick={() => handleTogglePrice(price)}
                      disabled={togglingPrice === price.id}
                    >
                      {togglingPrice === price.id ? "…" : price.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddPrice && (
        <Drawer title="Add a price" onClose={() => setShowAddPrice(false)}>
          <form onSubmit={handleAddPrice} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddPrice(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={adding}>
                {adding ? "Adding…" : "Add price"}
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
