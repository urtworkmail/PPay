import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";

export default function PayLink() {
  const { linkId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/payment-links/${linkId}/sessions`, { method: "POST", auth: false })
      .then((session) => {
        if (!cancelled) navigate(`/checkout/${session.id}`, { replace: true });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [linkId, navigate]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: "32px 30px", textAlign: "center" }}>
        {error ? (
          <p style={{ color: "var(--color-danger)" }}>{error}</p>
        ) : (
          <p style={{ color: "var(--color-text-muted)" }}>Taking you to checkout…</p>
        )}
      </div>
    </div>
  );
}
