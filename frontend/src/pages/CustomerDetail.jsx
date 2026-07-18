import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import { RelatedCard, SectionCard } from "../components/DetailKit";
import { ArrowLeftIcon, CopyIcon, LinkIcon } from "../components/Icons";
import StatusBadge from "../components/StatusBadge";

function StatBlock({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default function CustomerDetail() {
  const { email } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch(`/customers/${encodeURIComponent(email)}`)
      .then(setCustomer)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [email]);

  function copyEmail() {
    navigator.clipboard?.writeText(customer.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>;
  if (error && !customer) return <div className="badge badge-danger">{error}</div>;
  if (!customer) return null;

  const paymentLinkRows = customer.payment_links.map((link) => ({
    icon: <LinkIcon width={14} height={14} />,
    label: link.title,
    sublabel: "Payment link",
    to: `/dashboard/payment-links/${link.id}`,
  }));

  return (
    <div>
      <Link
        to="/dashboard/customers"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-text-muted)", textDecoration: "none", marginBottom: 18 }}
      >
        <ArrowLeftIcon width={14} height={14} /> Back
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 28, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>{customer.name || customer.email}</h1>
            {customer.name && <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: 13 }}>{customer.email}</p>}

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
              <StatBlock label="Total spent" value={formatMinorAmount(customer.total_spent_minor, customer.currency)} />
              <StatBlock label="Customer since" value={customer.first_seen_at ? formatDate(customer.first_seen_at) : "—"} />
              <StatBlock label="Successful payments" value={customer.transaction_count} />
            </div>
          </div>

          <SectionCard title="Details">
            <div style={{ padding: 18 }}>
              <button
                onClick={copyEmail}
                className="mono"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11.5,
                  padding: "5px 9px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-bg)",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  marginBottom: 14,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title="Copy email"
              >
                <CopyIcon width={12} height={12} style={{ flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{copied ? "Copied!" : customer.email}</span>
              </button>
              <div style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Last payment
              </div>
              <div style={{ fontSize: 13, marginBottom: 14 }}>{customer.last_transaction_at ? formatDate(customer.last_transaction_at) : "—"}</div>

              {customer.payment_methods.length > 0 && (
                <>
                  <div style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    Payment methods used
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {customer.payment_methods.map((m) => (
                      <div key={m} className="mono" style={{ fontSize: 12 }}>
                        {m}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {customer.saved_payment_methods.length > 0 && (
                <>
                  <div style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginBottom: 5, marginTop: 14, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    Saved on file
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {customer.saved_payment_methods.map((m) => (
                      <div key={m.id} className="mono" style={{ fontSize: 12 }}>
                        {m.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </SectionCard>

          <RelatedCard title="Payment links used" rows={paymentLinkRows} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {customer.subscriptions.length > 0 && (
            <SectionCard title="Subscriptions">
              <table>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Current period ends</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.subscriptions.map((s) => (
                    <tr key={s.id} onClick={() => navigate(`/dashboard/subscriptions/${s.id}`)} style={{ cursor: "pointer" }}>
                      <td>{formatMinorAmount(s.price.amount_minor, s.price.currency)} / {s.price.interval}</td>
                      <td>
                        <StatusBadge status={s.status} />
                      </td>
                      <td style={{ color: "var(--color-text-muted)" }}>{formatDate(s.current_period_end)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          )}

          <SectionCard title="Payments">
            {customer.transactions.length === 0 ? (
              <p style={{ padding: 18, color: "var(--color-text-muted)" }}>No payments yet.</p>
            ) : (
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
                  {customer.transactions.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link to={`/dashboard/transactions/${t.id}`} className="mono" style={{ color: "var(--color-accent)", textDecoration: "none" }}>
                          {t.gateway_reference ?? t.id.slice(0, 8)}
                        </Link>
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

          {customer.invoices.length > 0 && (
            <SectionCard title="Invoices">
              <table>
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link to={`/dashboard/invoices/${inv.id}`} style={{ color: "var(--color-accent)", textDecoration: "none" }}>
                          {formatMinorAmount(inv.amount_minor, inv.currency)}
                        </Link>
                      </td>
                      <td>
                        <StatusBadge status={inv.status} />
                      </td>
                      <td style={{ color: "var(--color-text-muted)" }}>{formatDate(inv.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
