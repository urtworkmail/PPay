import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, needsTotp ? totpCode : undefined);
      navigate("/dashboard");
    } catch (err) {
      if (err.message === "totp_required") {
        setNeedsTotp(true);
      } else {
        setError(err.message || "Login failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (needsTotp) {
    return (
      <AuthLayout title="Two-factor authentication" subtitle="Enter the 6-digit code from your authenticator app.">
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div className="badge badge-danger" style={{ width: "100%", padding: "10px 12px" }}>
              {error}
            </div>
          )}
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Authentication code
            <input
              className="mono"
              inputMode="numeric"
              autoFocus
              required
              maxLength={6}
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{ marginTop: 6, letterSpacing: "0.2em", textAlign: "center", fontSize: 18 }}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={submitting || totpCode.length !== 6} style={{ marginTop: 4 }}>
            {submitting ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => {
              setNeedsTotp(false);
              setTotpCode("");
              setError(null);
            }}
            style={{ background: "none", border: "none", color: "var(--color-text-muted)", fontSize: 13, cursor: "pointer" }}
          >
            ← Back
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Checkout, payouts, subscriptions, and fraud scoring — one dashboard. Sandbox mode, no real funds move."
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && (
          <div className="badge badge-danger" style={{ width: "100%", padding: "10px 12px" }}>
            {error}
          </div>
        )}
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </label>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          <span style={{ display: "flex", justifyContent: "space-between" }}>
            Password
            <Link to="/forgot-password" style={{ color: "var(--color-accent)", fontWeight: 600 }}>
              Forgot password?
            </Link>
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 8 }}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 20, textAlign: "center" }}>
        Don't have an account? <Link to="/register" style={{ color: "var(--color-accent)", fontWeight: 600 }}>Sign up</Link>
      </p>
    </AuthLayout>
  );
}
