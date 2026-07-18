import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import CheckoutShell from "../components/CheckoutShell";

export default function InvoicePay() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    apiFetch(`/invoices/${invoiceId}/public`, { auth: false })
      .then(setInvoice)
      .catch((err) => setError(err.message));
  }, [invoiceId]);

  async function handlePay() {
    setStarting(true);
    setError(null);
    try {
      const session = await apiFetch(`/invoices/${invoiceId}/sessions`, { method: "POST", auth: false });
      navigate(`/checkout/${session.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  }

  if (error && !invoice) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ width: "100%", maxWidth: 420, padding: "32px 30px" }}>
          <p style={{ color: "var(--color-danger)" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ width: "100%", maxWidth: 420, padding: "32px 30px" }}>
          <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  const brandColor = invoice.merchant?.brand_color || "#635bff";

  return (
    <CheckoutShell
      merchant={invoice.merchant}
      description={invoice.description || `Invoice for ${invoice.customer_name || invoice.customer_email}`}
      amountMinor={invoice.amount_minor}
      currency={invoice.currency}
      badge={invoice.status !== "paid" && invoice.status !== "cancelled" ? "Sandbox — no real funds move" : undefined}
    >
      <div className="card" style={{ padding: "28px 26px" }}>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 500 }}>Invoice for</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
          {invoice.customer_name || invoice.customer_email}
        </div>
        {invoice.due_date && (
          <div style={{ fontSize: 12.5, color: "var(--color-text-faint)", marginBottom: 14 }}>
            Due {formatDate(invoice.due_date)}
          </div>
        )}

        {invoice.status === "paid" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <span className="badge badge-success" style={{ padding: "8px 16px" }}>Already paid</span>
          </div>
        ) : invoice.status === "cancelled" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <span className="badge badge-danger" style={{ padding: "8px 16px" }}>This invoice was cancelled</span>
          </div>
        ) : (
          <>
            {error && <div className="badge badge-danger" style={{ display: "block", marginBottom: 12 }}>{error}</div>}
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 4, background: brandColor, boxShadow: "none" }}
              onClick={handlePay}
              disabled={starting}
            >
              {starting ? "Starting…" : `Pay ${formatMinorAmount(invoice.amount_minor, invoice.currency)}`}
            </button>
          </>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--color-text-faint)", marginTop: 20, textAlign: "center" }}>
        Powered by PPay
      </p>
    </CheckoutShell>
  );
}
