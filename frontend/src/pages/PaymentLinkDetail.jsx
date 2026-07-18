import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import { Field, SectionCard } from "../components/DetailKit";
import { CopyIcon } from "../components/Icons";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

export default function PaymentLinkDetail() {
  const { id } = useParams();
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      setLink(await apiFetch(`/payment-links/${id}`));
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
      await apiFetch(`/payment-links/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(link.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>;
  if (error && !link) return <div className="badge badge-danger">{error}</div>;
  if (!link) return null;

  return (
    <div>
      <PageHeader
        backTo="/dashboard/payment-links"
        title={
          <>
            {link.title}
            <span className={`badge ${link.is_active ? "badge-success" : "badge-danger"}`} style={{ textTransform: "capitalize" }}>
              {link.is_active ? "active" : "inactive"}
            </span>
          </>
        }
        subtitle={link.description}
        actions={
          link.is_active && (
            <button className="btn btn-danger" onClick={handleDeactivate}>
              Deactivate
            </button>
          )
        }
      />

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <SectionCard title="Summary" style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, padding: 18 }}>
          {link.product_name && <Field label="Product" value={link.product_name} />}
          <Field label="Amount" value={formatMinorAmount(link.amount_minor, link.currency)} />
          <Field label="Uses" value={link.usage_count} />
          <Field label="Customers" value={link.customer_count} />
          <Field label="Created" value={formatDate(link.created_at)} />
          <Field
            label="Link"
            value={
              <button
                onClick={copyLink}
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
                <CopyIcon width={13} height={13} /> {copied ? "Copied!" : "Copy link"}
              </button>
            }
          />
        </div>
      </SectionCard>

      <SectionCard title="Payments from this link">
        {link.transactions.length === 0 ? (
          <p style={{ padding: 18, color: "var(--color-text-muted)" }}>No payments yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {link.transactions.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/dashboard/transactions/${t.id}`} className="mono" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
                      {t.gateway_reference ?? t.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>
                    {t.customer_email ? (
                      <Link to={`/dashboard/customers/${encodeURIComponent(t.customer_email)}`} style={{ color: "var(--color-accent)", textDecoration: "none" }}>
                        {t.customer_email}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--color-text-faint)" }}>—</span>
                    )}
                  </td>
                  <td>{formatMinorAmount(t.amount_minor, t.currency)}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td style={{ color: "var(--color-text-muted)" }}>{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
