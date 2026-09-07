import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";

const RESEND_COOLDOWN_SECONDS = 45;

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [email, setEmail] = useState(params.get("email") ?? user?.email ?? "");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const tokenTried = useRef(false);

  // Arriving from the emailed link: redeem the token straight away so the user
  // doesn't have to retype a code they already clicked past.
  useEffect(() => {
    const token = params.get("token");
    if (!token || tokenTried.current) return;
    tokenTried.current = true;
    apiFetch("/auth/verify-email/token", { method: "POST", body: { token }, auth: false })
      .then(async (data) => {
        setStatus(data.message);
        await refreshProfile?.();
      })
      .catch((err) => setError(err.message));
  }, [params, refreshProfile]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleVerify(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/auth/verify-email", { method: "POST", body: { email, code }, auth: false });
      await refreshProfile?.();
      setStatus("Email verified.");
      setTimeout(() => navigate("/dashboard"), 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError(null);
    setBusy(true);
    try {
      const data = await apiFetch("/auth/resend-verification", { method: "POST", body: { email }, auth: false });
      setStatus(data.message);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="We sent a 6-digit code to your address. Enter it to finish setting up your account."
    >
      {error && (
        <div className="badge badge-danger" style={{ width: "100%", padding: "10px 12px", marginBottom: 14 }}>
          {error}
        </div>
      )}
      {status && (
        <div className="badge badge-success" style={{ width: "100%", padding: "10px 12px", marginBottom: 14 }}>
          {status}
        </div>
      )}

      <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
        <button className="btn btn-primary" type="submit" disabled={busy || code.length !== 6}>
          {busy ? "Verifying…" : "Verify email"}
        </button>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <button
          onClick={handleResend}
          disabled={busy || cooldown > 0 || !email}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: cooldown > 0 ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: cooldown > 0 ? "var(--color-text-faint)" : "var(--color-accent)",
          }}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
        <Link to="/dashboard" style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          Skip for now
        </Link>
      </div>

      <p style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 18, lineHeight: 1.5 }}>
        You can keep using sandbox mode while unverified, but a verified address is required before going live and
        before we'll send you any notification email.
      </p>
    </AuthLayout>
  );
}
