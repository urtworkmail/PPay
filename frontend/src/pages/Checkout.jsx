import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatMinorAmount } from "../api/format";

const METHODS = [
  { id: "card", label: "Card" },
  { id: "wallet", label: "Wallet" },
  { id: "bank_transfer", label: "Bank transfer" },
];

export default function Checkout() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [method, setMethod] = useState("card");
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [walletPhone, setWalletPhone] = useState("0300 0000000");
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch(`/checkout/sessions/${sessionId}`, { auth: false })
      .then(setSession)
      .catch((err) => setError(err.message));
  }, [sessionId]);

  async function handlePay(e) {
    e.preventDefault();
    setPaying(true);
    setError(null);
    try {
      const body = { method };
      if (method === "card") body.card_number = cardNumber;
      if (method === "wallet") body.wallet_phone = walletPhone;

      const transaction = await apiFetch(`/checkout/sessions/${sessionId}/pay`, {
        method: "POST",
        body,
        auth: false,
      });
      setResult(transaction);
      if (transaction.status === "succeeded" && session?.return_url) {
        setTimeout(() => {
          window.location.href = session.return_url;
        }, 1800);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying(false);
    }
  }

  if (error && !session) {
    return (
      <CenteredCard>
        <p style={{ color: "var(--color-danger)" }}>{error}</p>
      </CenteredCard>
    );
  }

  if (!session) {
    return (
      <CenteredCard>
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      </CenteredCard>
    );
  }

  if (result) {
    return (
      <CenteredCard>
        <ResultView result={result} returnUrl={session.return_url} />
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 500 }}>
          {session.description ?? "Payment request"}
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 4 }}>
          {formatMinorAmount(session.amount_minor, session.currency)}
        </div>
        <span className="badge badge-pending" style={{ marginTop: 10 }}>
          Sandbox — no real funds move
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={m.id === method ? "btn btn-primary" : "btn btn-secondary"}
            style={{ flex: 1, fontSize: 13, padding: "8px 10px" }}
            type="button"
          >
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={handlePay} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {method === "card" && (
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Card number
            <input
              className="mono"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </label>
        )}
        {method === "wallet" && (
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Wallet phone number
            <input
              className="mono"
              value={walletPhone}
              onChange={(e) => setWalletPhone(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </label>
        )}
        {method === "bank_transfer" && (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            You'll be asked to confirm the transfer from your bank. In sandbox mode this always succeeds.
          </p>
        )}

        {error && <div className="badge badge-danger">{error}</div>}

        <button className="btn btn-primary" type="submit" disabled={paying} style={{ marginTop: 4 }}>
          {paying ? "Processing…" : `Pay ${formatMinorAmount(session.amount_minor, session.currency)}`}
        </button>
      </form>

      <p style={{ fontSize: 11.5, color: "var(--color-text-faint)", marginTop: 20, textAlign: "center" }}>
        Secured by PPay · Sandbox mode
      </p>
    </CenteredCard>
  );
}

function ResultView({ result, returnUrl }) {
  const succeeded = result.status === "succeeded";
  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          margin: "0 auto 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          background: succeeded ? "var(--color-success-soft)" : "var(--color-danger-soft)",
          color: succeeded ? "var(--color-success)" : "var(--color-danger)",
        }}
      >
        {succeeded ? "✓" : "✕"}
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 6px" }}>
        {succeeded ? "Payment successful" : "Payment failed"}
      </h2>
      <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", marginBottom: 4 }}>
        {succeeded
          ? `Reference ${result.gateway_reference}`
          : result.failure_reason?.replace("_", " ") ?? "Please try another payment method."}
      </p>
      {succeeded && returnUrl && (
        <p style={{ fontSize: 12.5, color: "var(--color-text-faint)" }}>Redirecting you back…</p>
      )}
    </div>
  );
}

function CenteredCard({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: "32px 30px" }}>
        {children}
      </div>
    </div>
  );
}
