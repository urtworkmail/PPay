import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import PageHeader from "../components/PageHeader";
import { categoryLabel } from "../components/NotificationPanel";

const CATEGORY_HINT = {
  payment: "A payment succeeds, fails, or is disputed.",
  refund: "A refund is issued against a payment.",
  dispute: "A customer disputes a charge, or a dispute deadline is near.",
  payout: "A settlement batch is created or a payout is sent.",
  customer: "A customer record is created or updated.",
  invoice: "An invoice is issued, paid, or voided.",
  subscription: "A subscription is created, billed, or cancelled.",
  payment_link: "A payment link is created or updated.",
  product: "A product or price changes.",
  team: "A team member is invited, changes role, or is removed.",
  api_key: "An API key is created or revoked.",
  webhook: "A webhook endpoint is added or deactivated.",
  security: "Sign-ins, password changes, and session activity.",
  account: "Business, branding, payout, and go-live changes.",
};

export default function SettingsNotifications() {
  const [prefs, setPrefs] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  // Alternate delivery address flow.
  const [newEmail, setNewEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState(null);
  const [code, setCode] = useState("");

  async function load() {
    try {
      setPrefs(await apiFetch("/notifications/preferences"));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(patch) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      setPrefs(await apiFetch("/notifications/preferences", { method: "PATCH", body: patch }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(category) {
    const current = prefs.email_categories;
    const next = current.includes(category) ? current.filter((c) => c !== category) : [...current, category];
    save({ email_categories: next });
  }

  async function sendCode(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/notifications/preferences/email", { method: "POST", body: { email: newEmail } });
      setPendingEmail(newEmail);
      setNotice(`We sent a 6-digit code to ${newEmail}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmCode(e) {
    e.preventDefault();
    setError(null);
    try {
      setPrefs(
        await apiFetch("/notifications/preferences/email/verify", {
          method: "POST",
          body: { email: pendingEmail, code },
        })
      );
      setPendingEmail(null);
      setNewEmail("");
      setCode("");
      setNotice("Delivery address confirmed.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function clearOverride() {
    setPrefs(await apiFetch("/notifications/preferences/email", { method: "DELETE" }));
    setNotice("Notifications will go to your login email again.");
  }

  if (!prefs) {
    return (
      <div>
        <PageHeader backTo="/dashboard/settings" title="Notifications" />
        <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{error ?? "Loading…"}</div>
      </div>
    );
  }

  const deliveryAddress = prefs.email_address ?? prefs.login_email;
  const deliveryVerified = prefs.email_address ? prefs.email_verified : prefs.login_email_verified;

  return (
    <div>
      <PageHeader
        backTo="/dashboard/settings"
        title="Notifications"
        subtitle="Choose what reaches your inbox. Everything still appears in the in-app feed."
      />

      {error && <div className="badge badge-danger" style={{ marginBottom: 14, padding: "10px 12px" }}>{error}</div>}
      {notice && <div className="badge badge-success" style={{ marginBottom: 14, padding: "10px 12px" }}>{notice}</div>}

      <div className="card" style={{ padding: 22, maxWidth: 640, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Email notifications</div>
            <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 3 }}>
              Turn off to keep everything in-app only.
            </div>
          </div>
          <button
            role="switch"
            aria-checked={prefs.email_enabled}
            disabled={saving}
            onClick={() => save({ email_enabled: !prefs.email_enabled })}
            style={{
              width: 44,
              height: 25,
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              padding: 3,
              display: "flex",
              justifyContent: prefs.email_enabled ? "flex-end" : "flex-start",
              background: prefs.email_enabled ? "var(--color-accent)" : "var(--color-border)",
              transition: "background 0.15s ease",
            }}
          >
            <span style={{ width: 19, height: 19, borderRadius: "50%", background: "#fff", display: "block" }} />
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 22, maxWidth: 640, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Delivery address</div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginBottom: 14 }}>
          Where notification emails are sent. A new address has to be confirmed with a code before we'll use it.
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            background: "var(--color-bg)",
            borderRadius: "var(--radius-sm)",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 13.5, flex: 1, wordBreak: "break-all" }}>{deliveryAddress}</span>
          <span className={`badge ${deliveryVerified ? "badge-success" : "badge-pending"}`}>
            {deliveryVerified ? "Verified" : "Unverified"}
          </span>
          {prefs.email_address && (
            <button
              className="btn btn-secondary"
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={clearOverride}
            >
              Use login email
            </button>
          )}
        </div>

        {!deliveryVerified && !prefs.email_address && (
          <div className="badge badge-pending" style={{ padding: "10px 12px", marginBottom: 14, display: "block" }}>
            Your login email isn't verified yet, so no email will be sent. Verify it from Personal details.
          </div>
        )}

        {pendingEmail ? (
          <form onSubmit={confirmCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Enter the code sent to {pendingEmail}
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
              <button type="button" className="btn btn-secondary" onClick={() => setPendingEmail(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={code.length !== 6}>
                Confirm address
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={sendCode} style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <label style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
              Send notifications to a different address
              <input
                type="email"
                required
                placeholder="alerts@yourcompany.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                style={{ marginTop: 6 }}
              />
            </label>
            <button className="btn btn-secondary" type="submit" style={{ flexShrink: 0 }}>
              Send code
            </button>
          </form>
        )}
      </div>

      <div className="card" style={{ padding: 22, maxWidth: 640 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>What to email me about</div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginBottom: 16 }}>
          Unchecked categories still appear in the in-app notification feed.
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {prefs.available_categories.map((category) => {
            const checked = prefs.email_categories.includes(category);
            return (
              <label
                key={category}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 11,
                  padding: "11px 0",
                  borderBottom: "1px solid var(--color-border)",
                  cursor: prefs.email_enabled ? "pointer" : "not-allowed",
                  opacity: prefs.email_enabled ? 1 : 0.5,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!prefs.email_enabled || saving}
                  onChange={() => toggleCategory(category)}
                  style={{ width: 15, height: 15, padding: 0, marginTop: 2, flexShrink: 0 }}
                />
                <span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, display: "block" }}>{categoryLabel(category)}</span>
                  <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                    {CATEGORY_HINT[category] ?? ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
