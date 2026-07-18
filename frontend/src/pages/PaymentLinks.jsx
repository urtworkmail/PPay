import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatMinorAmount } from "../api/format";
import Drawer from "../components/Drawer";
import { CopyIcon, PlusIcon } from "../components/Icons";

function priceLabel(price) {
  return formatMinorAmount(price.amount_minor, price.currency);
}

export default function PaymentLinks() {
  const navigate = useNavigate();
  const [links, setLinks] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [priceId, setPriceId] = useState("");

  const oneTimePrices = products.flatMap((p) =>
    p.prices.filter((price) => price.is_active && price.interval === "one_time").map((price) => ({ ...price, productName: p.name }))
  );

  async function load() {
    try {
      const [linksData, productsData] = await Promise.all([apiFetch("/payment-links"), apiFetch("/products")]);
      setLinks(linksData);
      setProducts(productsData);
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
      await apiFetch("/payment-links", { method: "POST", body: { price_id: priceId } });
      setPriceId("");
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
            Turn a product's price into a shareable link — no website or integration required.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} disabled={oneTimePrices.length === 0}>
          <PlusIcon width={15} height={15} /> New link
        </button>
      </div>

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {!loading && oneTimePrices.length === 0 && (
        <div className="badge badge-pending" style={{ marginBottom: 16 }}>
          Create a product with a one-time price first (Product catalog → New product).
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : links.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>
            No payment links yet. Create one from a product to start collecting payments without any code.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Amount</th>
                <th>Uses</th>
                <th>Customers</th>
                <th>Status</th>
                <th>Link</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} onClick={() => navigate(`/dashboard/payment-links/${l.id}`)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{l.title}</div>
                    {l.description && (
                      <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{l.description}</div>
                    )}
                  </td>
                  <td>{formatMinorAmount(l.amount_minor, l.currency)}</td>
                  <td>{l.usage_count}</td>
                  <td>{l.customer_count}</td>
                  <td>
                    <span className={`badge ${l.is_active ? "badge-success" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>
                      {l.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyLink(l);
                      }}
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
                      <button
                        className="btn btn-danger"
                        style={{ padding: "5px 10px", fontSize: 12.5 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeactivate(l.id);
                        }}
                      >
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
        <Drawer
          title="Create payment link"
          subtitle="Pick a one-time price to turn into a shareable link."
          onClose={() => setShowCreate(false)}
        >
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Product & price
              <select required value={priceId} onChange={(e) => setPriceId(e.target.value)} style={{ marginTop: 6 }}>
                <option value="" disabled>
                  Select a one-time price
                </option>
                {oneTimePrices.map((price) => (
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
                {creating ? "Creating…" : "Create link"}
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
