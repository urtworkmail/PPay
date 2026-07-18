import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";

function DangerZone({ businessName }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState("");
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState(null);

  if (user?.role !== "owner") return null;

  async function handleClose() {
    setClosing(true);
    setError(null);
    try {
      await apiFetch("/merchants/me/close", { method: "POST", body: { business_name_confirmation: confirmation } });
      logout();
      navigate("/login");
    } catch (err) {
      setError(err.message);
      setClosing(false);
    }
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 480, marginTop: 20, borderColor: "var(--color-danger)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "var(--color-danger)" }}>Danger zone</div>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 14 }}>
        Closing your account signs out every team member immediately and blocks all further access, including API
        keys. This can't be undone from the dashboard.
      </p>
      {error && <div className="badge badge-danger" style={{ marginBottom: 14 }}>{error}</div>}
      <label style={{ fontSize: 13, fontWeight: 500 }}>
        Type <strong>{businessName}</strong> to confirm
        <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} style={{ marginTop: 6 }} />
      </label>
      <button
        className="btn btn-danger"
        style={{ marginTop: 14 }}
        disabled={confirmation !== businessName || closing}
        onClick={handleClose}
      >
        {closing ? "Closing…" : "Close account"}
      </button>
    </div>
  );
}

export default function SettingsBusiness() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch("/merchants/me").then((m) =>
      setForm({
        businessName: m.business_name,
        supportEmail: m.support_email || "",
        supportPhone: m.support_phone || "",
        businessAddress: m.business_address || "",
        businessWebsite: m.business_website || "",
        statementDescriptor: m.statement_descriptor || "",
      })
    );
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiFetch("/merchants/me/business", {
        method: "PATCH",
        body: {
          business_name: form.businessName,
          support_email: form.supportEmail || undefined,
          support_phone: form.supportPhone || undefined,
          business_address: form.businessAddress || undefined,
          business_website: form.businessWebsite || undefined,
          statement_descriptor: form.statementDescriptor || undefined,
        },
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <PageHeader backTo="/dashboard/settings" title="Business" subtitle="Public-facing business details shown to customers." />

      <div className="card" style={{ padding: 22, maxWidth: 480 }}>
        {error && <div className="badge badge-danger" style={{ marginBottom: 14 }}>{error}</div>}
        {success && <div className="badge badge-success" style={{ marginBottom: 14 }}>Saved</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Business name
            <input required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Support email
            <input type="email" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Support phone
            <input value={form.supportPhone} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Business address
            <input value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Website
            <input type="url" value={form.businessWebsite} onChange={(e) => setForm({ ...form, businessWebsite: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Statement descriptor
            <input
              placeholder="5–22 characters"
              minLength={5}
              maxLength={22}
              value={form.statementDescriptor}
              onChange={(e) => setForm({ ...form, statementDescriptor: e.target.value })}
              style={{ marginTop: 6 }}
            />
            <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 4 }}>
              Shown on your customers' bank or card statements.
            </div>
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>

      <DangerZone businessName={form.businessName} />
    </div>
  );
}
