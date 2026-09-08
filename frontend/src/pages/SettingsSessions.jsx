import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatDate, formatRelativeTime } from "../api/format";
import PageHeader from "../components/PageHeader";
import { MonitorIcon, ShieldIcon } from "../components/Icons";

/** Rough device/browser label from the user agent — good enough to let someone
 *  recognise their own devices, which is all this list has to do. */
function describeDevice(userAgent) {
  if (!userAgent) return "Unknown device";
  const ua = userAgent.toLowerCase();

  const os = ua.includes("windows")
    ? "Windows"
    : ua.includes("iphone") || ua.includes("ipad")
      ? "iOS"
      : ua.includes("mac os")
        ? "macOS"
        : ua.includes("android")
          ? "Android"
          : ua.includes("linux")
            ? "Linux"
            : null;

  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome") && !ua.includes("chromium")
      ? "Chrome"
      : ua.includes("firefox")
        ? "Firefox"
        : ua.includes("safari") && !ua.includes("chrome")
          ? "Safari"
          : ua.includes("curl")
            ? "API client"
            : null;

  if (!os && !browser) return userAgent.slice(0, 60);
  return [browser, os].filter(Boolean).join(" on ");
}

/** City-level location from the session's IP address (see services/geoip.py
 *  on the backend) — never device GPS, so this is only ever as precise as
 *  the sign-in's IP already was, and is null until that lookup succeeds. */
function describeLocation(session) {
  const parts = [session.city, session.region, session.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unknown location";
}

export default function SettingsSessions() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    apiFetch("/users/me/sessions")
      .then(setSessions)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function revoke(id) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/users/me/sessions/${id}`, { method: "DELETE" });
      setNotice("Session revoked. That device will be signed out when its token next refreshes.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function revokeOthers() {
    setBusyId("others");
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch("/users/me/sessions/revoke-others", { method: "POST" });
      setNotice(
        result.revoked === 0
          ? "No other devices were signed in."
          : `Signed out ${result.revoked} other device${result.revoked === 1 ? "" : "s"}.`
      );
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const others = sessions?.filter((s) => !s.is_current) ?? [];

  return (
    <div>
      <PageHeader
        backTo="/dashboard/settings/personal"
        title="Active sessions"
        subtitle="Every device currently signed in to your account."
        actions={
          others.length > 0 ? (
            <button
              className="btn btn-danger"
              style={{ padding: "8px 14px", fontSize: 13 }}
              disabled={busyId === "others"}
              onClick={revokeOthers}
            >
              {busyId === "others" ? "Signing out…" : "Sign out other devices"}
            </button>
          ) : null
        }
      />

      {error && <div className="badge badge-danger" style={{ marginBottom: 14, padding: "10px 12px" }}>{error}</div>}
      {notice && <div className="badge badge-success" style={{ marginBottom: 14, padding: "10px 12px" }}>{notice}</div>}

      <div
        className="card"
        style={{ padding: 14, maxWidth: 720, marginBottom: 20, display: "flex", gap: 11, alignItems: "flex-start" }}
      >
        <ShieldIcon width={16} height={16} style={{ color: "var(--color-accent)", flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          Revoking a session invalidates its refresh token. Access tokens are short-lived and stateless, so a revoked
          device loses access when its current token expires — within{" "}
          <strong style={{ color: "var(--color-text)" }}>30 minutes</strong> at most. To cut access immediately
          everywhere, change your password.
        </div>
      </div>

      {sessions === null ? (
        <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Loading…</div>
      ) : (
        <div className="card" style={{ maxWidth: 720, overflow: "hidden" }}>
          {sessions.length === 0 ? (
            <div style={{ padding: 28, fontSize: 13, color: "var(--color-text-muted)" }}>No active sessions.</div>
          ) : (
            sessions.map((session, index) => (
              <div
                key={session.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "16px 18px",
                  borderBottom: index === sessions.length - 1 ? "none" : "1px solid var(--color-border)",
                  background: session.is_current ? "var(--color-bg)" : "transparent",
                }}
              >
                <div className="related-row-icon" style={{ marginTop: 2 }}>
                  <MonitorIcon width={15} height={15} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                      {session.device_label || describeDevice(session.user_agent)}
                    </span>
                    {session.is_current && <span className="badge badge-success">This device</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 3 }}>
                    {describeLocation(session)} · IP {session.ip_address || "unknown"} · signed in {formatDate(session.created_at)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 2 }}>
                    Last active {formatRelativeTime(session.last_seen_at)}
                  </div>
                </div>
                {!session.is_current && (
                  <button
                    className="btn btn-danger"
                    style={{ padding: "6px 12px", fontSize: 12.5, flexShrink: 0 }}
                    disabled={busyId === session.id}
                    onClick={() => revoke(session.id)}
                  >
                    {busyId === session.id ? "Revoking…" : "Revoke"}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {others.length > 0 && (
        <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 14, maxWidth: 720 }}>
          {others.length} other {others.length === 1 ? "device is" : "devices are"} signed in. Don't recognise one?
          Revoke it and change your password.
        </p>
      )}
    </div>
  );
}
