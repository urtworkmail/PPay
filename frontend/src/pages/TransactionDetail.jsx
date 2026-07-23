import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import { Field, RelatedCard, SectionCard } from "../components/DetailKit";
import { InvoiceIcon, LinkIcon, ListIcon, UsersIcon } from "../components/Icons";
import Modal from "../components/Modal";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

export default function TransactionDetail() {
  const { id } = useParams();
  const [tx, setTx] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRefund, setShowRefund] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  async function load() {
    try {
      setTx(await apiFetch(`/transactions/${id}`));
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

  async function handleRefund() {
    setRefunding(true);
    try {
      await apiFetch(`/transactions/${id}/refund`, { method: "POST", body: { reason: refundReason || undefined } });
      setShowRefund(false);
      setRefundReason("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefunding(false);
    }
  }

  if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>;
  if (error && !tx) return <div className="badge badge-danger">{error}</div>;
  if (!tx) return null;

  const relatedRows = [
    tx.customer_email && {
      icon: <UsersIcon width={14} height={14} />,
      label: tx.customer_name || tx.customer_email,
      sublabel: tx.customer_name ? tx.customer_email : "Customer",
      to: `/dashboard/customers/${encodeURIComponent(tx.customer_email)}`,
    },
    tx.payment_link && {
      icon: <LinkIcon width={14} height={14} />,
      label: tx.payment_link.title,
      sublabel: "Payment link",
      to: `/dashboard/payment-links/${tx.payment_link.id}`,
    },
    tx.invoice && {
      icon: <InvoiceIcon width={14} height={14} />,
      label: `Invoice · ${tx.invoice.status}`,
      sublabel: "Invoice",
      to: `/dashboard/invoices/${tx.invoice.id}`,
    },
    tx.subscription && {
      icon: <ListIcon width={14} height={14} />,
      label: `Subscription · ${tx.subscription.status}`,
      sublabel: "Subscription",
      to: `/dashboard/subscriptions/${tx.subscription.id}`,
    },
  ];

  return (
    <div>
      <PageHeader
        backTo="/dashboard/transactions"
        title={
          <>
            <span className="mono">{tx.gateway_reference ?? tx.id.slice(0, 8)}</span>
            <StatusBadge status={tx.payment_intent_status === "requires_reconciliation" ? "requires_reconciliation" : tx.status} />
          </>
        }
        subtitle={formatDate(tx.created_at)}
        actions={
          tx.status === "succeeded" &&
          !tx.settled && (
            <button className="btn btn-danger" onClick={() => setShowRefund(true)}>
              Refund
            </button>
          )
        }
      />

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <SectionCard title="Summary">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, padding: 18 }}>
              <Field label="Amount" value={formatMinorAmount(tx.amount_minor, tx.currency)} />
              <Field label="Fee" value={formatMinorAmount(tx.fee_minor, tx.currency)} />
              <Field label="Net" value={formatMinorAmount(tx.net_amount_minor, tx.currency)} />
              <Field label="Method" value={<span style={{ textTransform: "capitalize" }}>{tx.payment_method_details?.method ?? "—"}</span>} />
              <Field label="Settled" value={tx.settled ? "Yes" : "No"} />
              {tx.failure_reason && <Field label="Failure reason" value={tx.failure_reason} />}
            </div>
          </SectionCard>

          <SectionCard title="Timeline">
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 18 }}>
              {tx.timeline.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 12, fontSize: 12.5 }}>
                  <div style={{ color: "var(--color-text-faint)", minWidth: 140 }}>{formatDate(e.at)}</div>
                  <div>{e.event}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          {tx.webhook_logs.length > 0 && (
            <SectionCard title="Webhook deliveries">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Response</th>
                    <th>Attempts</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {tx.webhook_logs.map((log) => (
                    <tr key={log.id}>
                      <td className="mono">{log.event_type}</td>
                      <td>
                        <StatusBadge status={log.status} />
                      </td>
                      <td style={{ color: "var(--color-text-muted)" }}>{log.response_status ?? "—"}</td>
                      <td style={{ color: "var(--color-text-muted)" }}>{log.attempt_count}</td>
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

          <SectionCard title="Details">
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 18 }}>
              <Field label="Transaction ID" value={<span className="mono" style={{ fontSize: 11.5 }}>{tx.id}</span>} />
              <Field
                label="Checkout session"
                value={<span className="mono" style={{ fontSize: 11.5 }}>{tx.checkout_session_id}</span>}
              />
              <Field label="Currency" value={tx.currency} />
              {tx.charge_attempts > 1 && <Field label="Charge attempts" value={tx.charge_attempts} />}
              {tx.payment_intent_status === "requires_reconciliation" && (
                <Field
                  label="Reconciliation"
                  value={<span style={{ color: "var(--color-text-muted)" }}>The rail didn't respond in time — we're checking automatically, not treating this as failed.</span>}
                />
              )}
              {tx.api_key_prefix && (
                <Field label="Created via API key" value={<span className="mono">{tx.api_key_prefix}_••••••••</span>} />
              )}
            </div>
          </SectionCard>

          {tx.refunds.length > 0 && (
            <SectionCard title="Refunds">
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 18 }}>
                {tx.refunds.map((r) => (
                  <div key={r.id} style={{ fontSize: 12.5 }}>
                    <div style={{ fontWeight: 600 }}>{formatMinorAmount(r.amount_minor, tx.currency)}</div>
                    <div style={{ color: "var(--color-text-muted)" }}>{r.reason || "No reason given"}</div>
                    <div style={{ color: "var(--color-text-faint)", fontSize: 11 }}>{formatDate(r.created_at)}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {showRefund && (
        <Modal title={`Refund ${formatMinorAmount(tx.amount_minor, tx.currency)}`} onClose={() => setShowRefund(false)}>
          <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", marginBottom: 14 }}>
            This fully refunds transaction <span className="mono">{tx.gateway_reference}</span>. In sandbox mode
            this is instant and simulated.
          </p>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Reason (optional)
            <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} style={{ marginTop: 6 }} />
          </label>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowRefund(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" style={{ flex: 1, borderColor: "var(--color-danger)" }} onClick={handleRefund} disabled={refunding}>
              {refunding ? "Refunding…" : "Confirm refund"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
