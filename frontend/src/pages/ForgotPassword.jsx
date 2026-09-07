import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import AuthLayout from "../components/AuthLayout";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("request"); // request -> confirm
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Deliberately returns the same message whether or not the address has
      // an account — the endpoint is built not to leak that.
      const data = await apiFetch("/auth/password-reset", { method: "POST", body: { email }, auth: false });
      setMessage(data.message);
      setStep("confirm");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/auth/password-reset/confirm", {
        method: "POST",
        body: { email, code, new_password: newPassword },
        auth: false,
      });
      navigate("/login", { state: { justReset: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (step === "confirm") {
    return (
      <AuthLayout title="Check your email" subtitle={`Enter the 6-digit code sent to ${email} and choose a new password.`}>
        {error && (
          <div className="badge badge-danger" style={{ width: "100%", padding: "10px 12px", marginBottom: 14 }}>
            {error}
          </div>
        )}
        <form onSubmit={confirmReset} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Verification code
            <input
              className="mono"
              required
              maxLength={6}
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{ marginTop: 6, letterSpacing: "0.3em", fontSize: 18 }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            New password
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ marginTop: 6 }}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy || code.length !== 6}>
            {busy ? "Resetting…" : "Reset password"}
          </button>
          <button
            type="button"
            onClick={() => setStep("request")}
            style={{ background: "none", border: "none", color: "var(--color-text-muted)", fontSize: 13, cursor: "pointer" }}
          >
            ← Use a different email
          </button>
        </form>
        <p style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 16 }}>
          Resetting your password signs you out on every device — you'll need to log in again everywhere.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your account email and we'll send a code to reset it.">
      {error && (
        <div className="badge badge-danger" style={{ width: "100%", padding: "10px 12px", marginBottom: 14 }}>
          {error}
        </div>
      )}
      {message && (
        <div className="badge badge-success" style={{ width: "100%", padding: "10px 12px", marginBottom: 14 }}>
          {message}
        </div>
      )}
      <form onSubmit={requestCode} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginTop: 6 }} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send reset code"}
        </button>
      </form>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 20, textAlign: "center" }}>
        <Link to="/login" style={{ color: "var(--color-accent)", fontWeight: 600 }}>
          ← Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
