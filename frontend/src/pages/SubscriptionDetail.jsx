import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import { Field, RelatedCard, SectionCard } from "../components/DetailKit";
import { BoxIcon, CopyIcon, UsersIcon } from "../components/Icons";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

export default function SubscriptionDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [copied, setCopied] = useState(false);
  const checkoutUrl = location.state?.checkoutUrl;

  async function load() {
    try {
      setSubscription(await apiFetch(`/subscriptions/${id}`));
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

  async function handleCancel(atPeriodEnd) {
    setCanceling(true);
    try {
      await apiFetch(`/subscriptions/${id}/cancel`, { method: "POST", body: { at_period_end: atPeriodEnd } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCanceling(false);
    }
  }

  function copyUrl() {
    navigator.clipboard?.writeText(checkoutUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>;
  if (error && !subscription) return <div className="badge badge-danger">{error}</div>;
  if (!subscription) return null;

  const canCancel = subscription.status !== "canceled";

  const relatedRows = [
    {
      icon: <UsersIcon width={14} height={14} />,
      label: subscription.customer_name || subscription.customer_email,
      sublabel: subscription.customer_name ? subscription.customer_email : "Customer",
      to: `/dashboard/customers/${encodeURIComponent(subscription.customer_email)}`,
    },
    subscription.product_name && {
      icon: <BoxIcon width={14} height={14} />,
      label: subscription.product_name,
      sublabel: `${formatMinorAmount(subscription.price.amount_minor, subscription.price.currency)} / ${subscription.price.interval}`,
      to: "/dashboard/products",
    },
    subscription.payment_method && {
      icon: <span className="mono" style={{ fontSize: 11 }}>{subscription.payment_method.method === "card" ? "C" : "W"}</span>,
      label: subscription.payment_method.label,
      sublabel: "Payment method on file",
      to: `/dashboard/customers/${encodeURIComponent(subscription.customer_email)}`,
    },
  ];

  return (
    <div>
      <PageHeader
        backTo="/dashboard/subscriptions"
        title={
          <>
            {subscription.customer_name || subscription.customer_email}
            <StatusBadge status={subscription.status} />
          </>
        }
        subtitle={`${formatMinorAmount(subscription.price.amount_minor, subscription.price.currency)} / ${subscription.price.interval}`}
        actions={
          canCancel && (
            <div style={{ display: "flex", gap: 8 }}>
              {!subscription.cancel_at_period_end && (
                <button className="btn btn-secondary" onClick={() => handleCancel(true)} disabled={canceling}>
                  Cancel at period end
                </button>
              )}
              <button className="btn btn-danger" onClick={() => handleCancel(false)} disabled={canceling}>
                Cancel now
              </button>
            </div>
          )
        }
      />

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {checkoutUrl && (
        <div className="card" style={{ padding: 16, marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Awaiting first payment</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              This customer has no saved payment method yet — share this link so they can complete the first charge and activate the subscription.
            </div>
          </div>
          <button
            onClick={copyUrl}
            className="btn btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 16 }}
          >
            <CopyIcon width={13} height={13} /> {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}

      {subscription.cancel_at_period_end && subscription.status !== "canceled" && (
        <div className="badge badge-pending" style={{ marginBottom: 16 }}>
          This subscription will cancel at the end of the current period ({formatDate(subscription.current_period_end)}).
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <SectionCard title="Summary">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, padding: 18 }}>
              <Field label="Current period start" value={formatDate(subscription.current_period_start)} />
              <Field label="Current period end" value={formatDate(subscription.current_period_end)} />
              <Field label="Failed charge attempts" value={subscription.failed_attempt_count} />
              <Field label="Created" value={formatDate(subscription.created_at)} />
              <Field label="Canceled at" value={subscription.canceled_at ? formatDate(subscription.canceled_at) : "—"} />
            </div>
          </SectionCard>

          <SectionCard title="Billing history">
            {subscription.invoices.length === 0 ? (
              <p style={{ padding: 18, color: "var(--color-text-muted)" }}>No invoices generated yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Charge</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {subscription.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{formatMinorAmount(inv.amount_minor, inv.currency)}</td>
                      <td style={{ color: "var(--color-text-muted)" }}>{inv.description ?? "—"}</td>
                      <td>
                        <StatusBadge status={inv.status} />
                      </td>
                      <td>
                        {inv.transaction ? (
                          <Link
                            to={`/dashboard/transactions/${inv.transaction.id}`}
                            className="mono"
                            style={{ color: "var(--color-accent)", textDecoration: "none" }}
                          >
                            {inv.transaction.gateway_reference ?? inv.transaction.id.slice(0, 8)}
                          </Link>
                        ) : (
                          <span style={{ color: "var(--color-text-faint)" }}>—</span>
                        )}
                      </td>
                      <td style={{ color: "var(--color-text-muted)" }}>{formatDate(inv.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          {subscription.webhook_logs.length > 0 && (
            <SectionCard title="Webhook deliveries">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Response</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {subscription.webhook_logs.map((log) => (
                    <tr key={log.id}>
                      <td className="mono">{log.event_type}</td>
                      <td>
                        <StatusBadge status={log.status} />
                      </td>
                      <td style={{ color: "var(--color-text-muted)" }}>{log.response_status ?? "—"}</td>
                      <td style={{ color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{formatDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <RelatedCard rows={relatedRows} />
        </div>
      </div>
    </div>
  );
}
