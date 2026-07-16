import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";

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

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: "32px 30px" }}>
        {error && !invoice && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
        {invoice && (
          <>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 500 }}>Invoice for</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
              {invoice.customer_name || invoice.customer_email}
            </div>
            {invoice.description && (
              <div style={{ fontSize: 13.5, color: "var(--color-text-muted)", marginBottom: 10 }}>{invoice.description}</div>
            )}
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.01em", margin: "10px 0" }}>
              {formatMinorAmount(invoice.amount_minor, invoice.currency)}
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
                <span className="badge badge-pending" style={{ marginBottom: 16 }}>Sandbox — no real funds move</span>
                {error && <div className="badge badge-danger" style={{ display: "block", marginTop: 12 }}>{error}</div>}
                <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={handlePay} disabled={starting}>
                  {starting ? "Starting…" : `Pay ${formatMinorAmount(invoice.amount_minor, invoice.currency)}`}
                </button>
              </>
            )}
            <p style={{ fontSize: 11.5, color: "var(--color-text-faint)", marginTop: 20, textAlign: "center" }}>
              Secured by PPay
            </p>
          </>
        )}
        {!invoice && !error && <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>}
      </div>
    </div>
  );
}
