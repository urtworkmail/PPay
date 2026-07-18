import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatDate } from "../api/format";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";

function TwoFactorCard() {
  const [profile, setProfile] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch("/users/me").then(setProfile);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleEnroll() {
    setError(null);
    try {
      setEnrollment(await apiFetch("/users/me/totp/enroll", { method: "POST" }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/users/me/totp/verify", { method: "POST", body: { code } });
      setEnrollment(null);
      setCode("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/users/me/totp/disable", { method: "POST", body: { password } });
      setShowDisable(false);
      setPassword("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return null;

  return (
    <div className="card" style={{ padding: 22, maxWidth: 480, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Two-factor authentication</div>
        <span className={`badge ${profile.totp_enabled ? "badge-success" : "badge-neutral"}`}>
          {profile.totp_enabled ? "Enabled" : "Not enabled"}
        </span>
      </div>
      {error && <div className="badge badge-danger" style={{ marginBottom: 14 }}>{error}</div>}

      {profile.totp_enabled ? (
        showDisable ? (
          <form onSubmit={handleDisable} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Confirm your password to disable
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 6 }} />
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDisable(false)}>Cancel</button>
              <button type="submit" className="btn btn-danger" disabled={busy}>{busy ? "Disabling…" : "Disable 2FA"}</button>
            </div>
          </form>
        ) : (
          <button className="btn btn-danger" onClick={() => setShowDisable(true)}>Disable two-factor authentication</button>
        )
      ) : enrollment ? (
        <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
            Add this key to your authenticator app (Google Authenticator, 1Password, Authy…), then enter the code it
            shows to confirm.
          </p>
          <div style={{ fontSize: 12, color: "var(--color-text-faint)" }}>Secret key</div>
          <code className="mono" style={{ fontSize: 13, wordBreak: "break-all", background: "var(--color-bg)", padding: "8px 10px", borderRadius: "var(--radius-sm)" }}>
            {enrollment.secret}
          </code>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Confirmation code
            <input
              className="mono"
              required
              maxLength={6}
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{ marginTop: 6 }}
            />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setEnrollment(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Confirm & enable"}</button>
          </div>
        </form>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 14 }}>
            Recommended before handling real payments — require a code from an authenticator app in addition to
            your password.
          </p>
          <button className="btn btn-primary" onClick={handleEnroll}>Set up two-factor authentication</button>
        </div>
      )}
    </div>
  );
}

function SessionsCard() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    apiFetch("/users/me/sessions").then(setSessions).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRevoke(id) {
    try {
      await apiFetch(`/users/me/sessions/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!sessions) return null;

  return (
    <div className="card" style={{ padding: 22, maxWidth: 480 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Active sessions</div>
      {error && <div className="badge badge-danger" style={{ marginBottom: 14 }}>{error}</div>}
      {sessions.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>No active sessions.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sessions.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ fontSize: 12.5 }}>
                <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {s.ip_address || "Unknown IP"}
                  {s.is_current && <span className="badge badge-success">This device</span>}
                </div>
                <div style={{ color: "var(--color-text-muted)", marginTop: 2, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.user_agent || "Unknown device"}
                </div>
                <div style={{ color: "var(--color-text-faint)", marginTop: 2 }}>Last active {formatDate(s.last_seen_at)}</div>
              </div>
              {!s.is_current && (
                <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: 12, flexShrink: 0 }} onClick={() => handleRevoke(s.id)}>
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsPersonal() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiFetch("/users/me/change-password", {
        method: "POST",
        body: { current_password: form.currentPassword, new_password: form.newPassword },
      });
      setForm({ currentPassword: "", newPassword: "" });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader backTo="/dashboard/settings" title="Personal details" subtitle="Your account identity, password, and security." />

      <div className="card" style={{ padding: 22, maxWidth: 480, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Account</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5 }}>
          <div>
            <div style={{ color: "var(--color-text-faint)", fontSize: 12 }}>Email</div>
            <div>{user?.email}</div>
          </div>
          <div>
            <div style={{ color: "var(--color-text-faint)", fontSize: 12 }}>Role</div>
            <div style={{ textTransform: "capitalize" }}>{user?.role}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 22, maxWidth: 480, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Change password</div>
        {error && <div className="badge badge-danger" style={{ marginBottom: 14 }}>{error}</div>}
        {success && <div className="badge badge-success" style={{ marginBottom: 14 }}>Password updated</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Current password
            <input required type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            New password
            <input required type="password" minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>

      <TwoFactorCard />
      <SessionsCard />
    </div>
  );
}
