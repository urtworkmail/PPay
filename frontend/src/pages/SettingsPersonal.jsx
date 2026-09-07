import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

/** A compact summary that links out to the full Active sessions page rather
 *  than repeating the whole list here. */
function SessionsSummaryCard() {
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    apiFetch("/users/me/sessions").then(setSessions).catch(() => setSessions([]));
  }, []);

  const count = sessions?.length ?? 0;
  const mostRecent = sessions?.find((s) => !s.is_current);

  return (
    <div className="card" style={{ padding: 22, maxWidth: 480, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Active sessions</div>
        {sessions && <span className="badge badge-neutral">{count} signed in</span>}
      </div>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
        {sessions === null
          ? "Checking your signed-in devices…"
          : count <= 1
            ? "Only this device is signed in."
            : `This device and ${count - 1} other${count > 2 ? "s" : ""}${
                mostRecent ? `, last active ${formatDate(mostRecent.last_seen_at)}` : ""
              }.`}
      </p>
      <Link to="/dashboard/settings/sessions" className="btn btn-secondary" style={{ textDecoration: "none" }}>
        Manage sessions
      </Link>
    </div>
  );
}

function ProfileCard({ user, onSaved }) {
  const [form, setForm] = useState({
    name: user?.name ?? "",
    phone: user?.phone ?? "",
    job_title: user?.job_title ?? "",
    timezone_name: user?.timezone_name ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch("/users/me", { method: "PATCH", body: form });
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 480, marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Your details</div>
      {error && <div className="badge badge-danger" style={{ marginBottom: 14 }}>{error}</div>}
      {saved && <div className="badge badge-success" style={{ marginBottom: 14 }}>Details saved</div>}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Full name
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Your name"
            style={{ marginTop: 6 }}
          />
        </label>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Job title
          <input
            value={form.job_title}
            onChange={(e) => setForm({ ...form, job_title: e.target.value })}
            placeholder="Founder, Finance lead…"
            style={{ marginTop: 6 }}
          />
        </label>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Phone
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+92 300 0000000"
            style={{ marginTop: 6 }}
          />
        </label>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Time zone
          <input
            value={form.timezone_name}
            onChange={(e) => setForm({ ...form, timezone_name: e.target.value })}
            placeholder="Asia/Karachi"
            style={{ marginTop: 6 }}
          />
          <span style={{ fontSize: 11.5, color: "var(--color-text-faint)", display: "block", marginTop: 5 }}>
            Used for report boundaries and timestamps in emails.
          </span>
        </label>
        <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
          {saving ? "Saving…" : "Save details"}
        </button>
      </form>
    </div>
  );
}

function EmailVerificationCard({ user, onVerified }) {
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  if (user?.email_verified) {
    return (
      <div className="card" style={{ padding: 22, maxWidth: 480, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Email address</div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 3 }}>{user.email}</div>
          </div>
          <span className="badge badge-success">Verified</span>
        </div>
      </div>
    );
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch("/auth/resend-verification", {
        method: "POST",
        body: { email: user.email },
        auth: false,
      });
      setNotice(data.message);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/auth/verify-email", { method: "POST", body: { email: user.email, code }, auth: false });
      setNotice("Email verified.");
      onVerified?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 480, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Email address</div>
        <span className="badge badge-pending">Unverified</span>
      </div>
      {error && <div className="badge badge-danger" style={{ marginBottom: 12 }}>{error}</div>}
      {notice && <div className="badge badge-success" style={{ marginBottom: 12 }}>{notice}</div>}
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
        {user?.email} isn't confirmed yet. Verify it to receive notification email and to be eligible for live mode.
      </p>
      {sent ? (
        <form onSubmit={verify} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <label style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
            6-digit code
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
          <button className="btn btn-primary" type="submit" disabled={busy || code.length !== 6} style={{ flexShrink: 0 }}>
            Verify
          </button>
        </form>
      ) : (
        <button className="btn btn-primary" onClick={sendCode} disabled={busy}>
          {busy ? "Sending…" : "Send verification code"}
        </button>
      )}
    </div>
  );
}

export default function SettingsPersonal() {
  const { user, refreshProfile } = useAuth();
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
          <div>
            <div style={{ color: "var(--color-text-faint)", fontSize: 12 }}>Member since</div>
            <div>{formatDate(user?.created_at)}</div>
          </div>
          <div>
            <div style={{ color: "var(--color-text-faint)", fontSize: 12 }}>Last sign-in</div>
            <div>{formatDate(user?.last_login_at)}</div>
          </div>
        </div>
      </div>

      <EmailVerificationCard user={user} onVerified={refreshProfile} />
      <ProfileCard user={user} onSaved={refreshProfile} />

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
      <SessionsSummaryCard />

      <div className="card" style={{ padding: 22, maxWidth: 480 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Notifications</div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
          Choose which account activity is emailed to you, and where it's sent.
        </p>
        <Link to="/dashboard/settings/notifications" className="btn btn-secondary" style={{ textDecoration: "none" }}>
          Notification settings
        </Link>
      </div>
    </div>
  );
}
