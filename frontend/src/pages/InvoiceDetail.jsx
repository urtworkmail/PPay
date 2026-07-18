import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import { Field, RelatedCard, SectionCard } from "../components/DetailKit";
import { CopyIcon, ListIcon, UsersIcon } from "../components/Icons";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

export default function InvoiceDetail() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      setInvoice(await apiFetch(`/invoices/${id}`));
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

  async function handleCancel() {
    try {
      await apiFetch(`/invoices/${id}/cancel`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(invoice.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>;
  if (error && !invoice) return <div className="badge badge-danger">{error}</div>;
  if (!invoice) return null;

  const relatedRows = [
    {
      icon: <UsersIcon width={14} height={14} />,
      label: invoice.customer_name || invoice.customer_email,
      sublabel: invoice.customer_name ? invoice.customer_email : "Customer",
      to: `/dashboard/customers/${encodeURIComponent(invoice.customer_email)}`,
    },
    invoice.subscription && {
      icon: <ListIcon width={14} height={14} />,
      label: `Subscription · ${invoice.subscription.status}`,
      sublabel: invoice.billing_reason === "subscription_first" ? "First subscription charge" : "Subscription renewal",
      to: `/dashboard/subscriptions/${invoice.subscription.id}`,
    },
  ];

  return (
    <div>
      <PageHeader
        backTo="/dashboard/invoices"
        title={
          <>
            {invoice.customer_name || invoice.customer_email}
            <StatusBadge status={invoice.status} />
          </>
        }
        subtitle={invoice.customer_name ? invoice.customer_email : undefined}
        actions={
          invoice.status === "sent" && (
            <button className="btn btn-danger" onClick={handleCancel}>
              Cancel invoice
            </button>
          )
        }
      />

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <SectionCard title="Summary">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, padding: 18 }}>
              <Field label="Amount" value={formatMinorAmount(invoice.amount_minor, invoice.currency)} />
              <Field label="Due date" value={invoice.due_date ? formatDate(invoice.due_date) : "—"} />
              <Field label="Sent" value={invoice.sent_at ? formatDate(invoice.sent_at) : "—"} />
              <Field label="Paid" value={invoice.paid_at ? formatDate(invoice.paid_at) : "—"} />
              <Field label="Description" value={invoice.description} />
              {invoice.url && (
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
              )}
            </div>
          </SectionCard>

          <SectionCard title="Payment">
            {invoice.transaction ? (
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <Link
                        to={`/dashboard/transactions/${invoice.transaction.id}`}
                        className="mono"
                        style={{ color: "var(--color-accent)", textDecoration: "none" }}
                      >
                        {invoice.transaction.gateway_reference ?? invoice.transaction.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>{formatMinorAmount(invoice.transaction.amount_minor, invoice.transaction.currency)}</td>
                    <td>
                      <StatusBadge status={invoice.transaction.status} />
                    </td>
                    <td style={{ color: "var(--color-text-muted)" }}>{formatDate(invoice.transaction.created_at)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p style={{ padding: 18, color: "var(--color-text-muted)" }}>Not paid yet.</p>
            )}
          </SectionCard>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <RelatedCard rows={relatedRows} />
        </div>
      </div>
    </div>
  );
}
