import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatMinorAmount } from "../api/format";
import CheckoutShell from "../components/CheckoutShell";

const ALL_METHODS = [
  { id: "card", label: "Card" },
  { id: "wallet", label: "Wallet" },
  { id: "bank_transfer", label: "Bank transfer" },
];

function formatCardNumber(value) {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function Checkout() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [method, setMethod] = useState("card");
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/29");
  const [cvc, setCvc] = useState("123");
  const [walletPhone, setWalletPhone] = useState("0300 0000000");
  const [email, setEmail] = useState("");
  const [saveMethod, setSaveMethod] = useState(false);
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch(`/checkout/sessions/${sessionId}`, { auth: false })
      .then((data) => {
        setSession(data);
        const enabled = data.merchant?.enabled_payment_methods;
        if (enabled?.length && !enabled.includes("card")) {
          setMethod(enabled[0]);
        }
      })
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
      if (!session?.customer_email && email) body.customer_email = email;
      if ((method === "card" || method === "wallet") && (session?.customer_email || email)) {
        body.save_payment_method = saveMethod;
      }

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

  const brandColor = session.merchant?.brand_color || "#635bff";
  const enabledIds = session.merchant?.enabled_payment_methods;
  const METHODS = enabledIds?.length ? ALL_METHODS.filter((m) => enabledIds.includes(m.id)) : ALL_METHODS;

  if (result) {
    return (
      <CheckoutShell
        merchant={session.merchant}
        description={session.description}
        amountMinor={session.amount_minor}
        currency={session.currency}
      >
        <div className="card" style={{ padding: "32px 30px" }}>
          <ResultView result={result} returnUrl={session.return_url} />
        </div>
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell
      merchant={session.merchant}
      description={session.description ?? "Payment request"}
      amountMinor={session.amount_minor}
      currency={session.currency}
      badge="Sandbox — no real funds move"
    >
      <div className="card" style={{ padding: "28px 26px" }}>
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
          {!session.customer_email && (
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Email
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ marginTop: 6 }}
              />
            </label>
          )}
          {method === "card" && (
            <>
              <label style={{ fontSize: 13, fontWeight: 500 }}>
                Card number
                <input
                  className="mono card-number-input"
                  inputMode="numeric"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  style={{ marginTop: 6 }}
                />
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
                  Expiry
                  <input
                    className="mono"
                    inputMode="numeric"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    style={{ marginTop: 6 }}
                  />
                </label>
                <label style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
                  CVC
                  <input
                    className="mono"
                    inputMode="numeric"
                    placeholder="123"
                    maxLength={4}
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    style={{ marginTop: 6 }}
                  />
                </label>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--color-text-faint)", margin: 0 }}>
                Sandbox mode — any future expiry and any CVC are accepted. Nothing here is stored or checked against a real card network.
              </p>
            </>
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

          {(method === "card" || method === "wallet") && (session?.customer_email || email) && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={saveMethod} onChange={(e) => setSaveMethod(e.target.checked)} style={{ width: "auto" }} />
              Save this {method === "card" ? "card" : "wallet"} for future payments
            </label>
          )}

          {error && <div className="badge badge-danger">{error}</div>}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={paying}
            style={{ marginTop: 4, background: brandColor, boxShadow: "none" }}
          >
            {paying ? "Processing…" : `Pay ${formatMinorAmount(session.amount_minor, session.currency)}`}
          </button>
        </form>
      </div>

      <p style={{ fontSize: 11.5, color: "var(--color-text-faint)", marginTop: 20, textAlign: "center" }}>
        Powered by PPay · Sandbox mode
        {(session.merchant?.checkout_terms_url || session.merchant?.checkout_privacy_url) && (
          <>
            {" · "}
            {session.merchant.checkout_terms_url && (
              <a href={session.merchant.checkout_terms_url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                Terms
              </a>
            )}
            {session.merchant.checkout_terms_url && session.merchant.checkout_privacy_url && " · "}
            {session.merchant.checkout_privacy_url && (
              <a href={session.merchant.checkout_privacy_url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                Privacy
              </a>
            )}
          </>
        )}
      </p>
    </CheckoutShell>
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
