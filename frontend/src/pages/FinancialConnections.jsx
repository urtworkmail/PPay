import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate } from "../api/format";
import PageHeader from "../components/PageHeader";
import { PlugIcon } from "../components/Icons";

export default function FinancialConnections() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [amounts, setAmounts] = useState({ amount_1: "", amount_2: "" });

  function load() {
    apiFetch("/merchants/me/financial-connections")
      .then(setStatus)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function startVerification() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/merchants/me/financial-connections/start", { method: "POST" });
      setNotice("Verification started. Check your notifications for the deposit amounts.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmVerification(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/merchants/me/financial-connections/confirm", {
        method: "POST",
        body: { amount_1: Number(amounts.amount_1), amount_2: Number(amounts.amount_2) },
      });
      setNotice("Bank account verified.");
      setAmounts({ amount_1: "", amount_2: "" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const hasPendingVerification = status && status.attempts_remaining !== null;
  const hasBankAccount = status?.bank_name || status?.account_number_masked;

  return (
    <div>
      <PageHeader
        title="Financial Connections"
        subtitle="Prove you control the bank account your payouts are sent to."
      />

      {error && <div className="badge badge-danger" style={{ marginBottom: 16, padding: "10px 12px" }}>{error}</div>}
      {notice && <div className="badge badge-success" style={{ marginBottom: 16, padding: "10px 12px" }}>{notice}</div>}

      {!status ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : !hasBankAccount ? (
        <div className="card" style={{ padding: 28, textAlign: "center", maxWidth: 480 }}>
          <PlugIcon width={24} height={24} style={{ color: "var(--color-text-faint)" }} />
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>No payout bank account yet</div>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "6px 0 16px" }}>
            Add one in Settings before you can verify it.
          </p>
          <Link to="/dashboard/settings/payout" className="btn btn-primary" style={{ textDecoration: "none" }}>
            Add payout bank account
          </Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 24, maxWidth: 520 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{status.bank_name}</div>
              <div className="mono" style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2 }}>
                {status.account_number_masked}
              </div>
            </div>
            <span className={`badge ${status.verified_at ? "badge-success" : "badge-pending"}`}>
              {status.verified_at ? "Verified" : "Unverified"}
            </span>
          </div>

          {status.verified_at ? (
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
              Verified {formatDate(status.verified_at)}. Changing the account number will require re-verifying.
            </p>
          ) : hasPendingVerification ? (
            <>
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 14px", lineHeight: 1.55 }}>
                Two small deposits were sent {status.verification_sent_at ? formatDate(status.verification_sent_at) : "recently"}.
                In a live deployment these would appear on your bank statement in 1–2 business days; in sandbox mode
                they were included directly in the notification we sent you. Enter both amounts (in paisa, 1–99) to
                confirm you control this account.
              </p>
              <form onSubmit={confirmVerification} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>
                  Amount 1
                  <input
                    type="number"
                    required
                    min={1}
                    max={99}
                    value={amounts.amount_1}
                    onChange={(e) => setAmounts({ ...amounts, amount_1: e.target.value })}
                    style={{ marginTop: 6, width: 90 }}
                  />
                </label>
                <label style={{ fontSize: 13, fontWeight: 500 }}>
                  Amount 2
                  <input
                    type="number"
                    required
                    min={1}
                    max={99}
                    value={amounts.amount_2}
                    onChange={(e) => setAmounts({ ...amounts, amount_2: e.target.value })}
                    style={{ marginTop: 6, width: 90 }}
                  />
                </label>
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? "Checking…" : "Confirm"}
                </button>
              </form>
              <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 12 }}>
                {status.attempts_remaining} attempt{status.attempts_remaining === 1 ? "" : "s"} remaining
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 14px" }}>
                Not verified yet. Start verification to receive two small confirmation deposits.
              </p>
              <button className="btn btn-primary" onClick={startVerification} disabled={busy}>
                {busy ? "Starting…" : "Start verification"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
