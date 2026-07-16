import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatMinorAmount } from "../api/format";

export default function PayLink() {
  const { linkId } = useParams();
  const navigate = useNavigate();
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    apiFetch(`/payment-links/${linkId}/public`, { auth: false })
      .then(setLink)
      .catch((err) => setError(err.message));
  }, [linkId]);

  async function handlePay() {
    setStarting(true);
    setError(null);
    try {
      const session = await apiFetch(`/payment-links/${linkId}/sessions`, { method: "POST", auth: false });
      navigate(`/checkout/${session.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: "32px 30px", textAlign: "center" }}>
        {error && !link && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
        {link && (
          <>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 500 }}>{link.title}</div>
            {link.description && (
              <div style={{ fontSize: 13.5, color: "var(--color-text-muted)", marginTop: 4 }}>{link.description}</div>
            )}
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em", margin: "14px 0" }}>
              {formatMinorAmount(link.amount_minor, link.currency)}
            </div>
            <span className="badge badge-pending" style={{ marginBottom: 20 }}>
              Sandbox — no real funds move
            </span>
            {error && <div className="badge badge-danger" style={{ display: "block", marginTop: 12 }}>{error}</div>}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={handlePay} disabled={starting}>
              {starting ? "Starting…" : "Continue to pay"}
            </button>
            <p style={{ fontSize: 11.5, color: "var(--color-text-faint)", marginTop: 20 }}>Secured by PPay</p>
          </>
        )}
        {!link && !error && <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>}
      </div>
    </div>
  );
}
