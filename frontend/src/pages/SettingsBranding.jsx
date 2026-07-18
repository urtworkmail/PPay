import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import PageHeader from "../components/PageHeader";

const DEFAULT_COLOR = "#635bff";

export default function SettingsBranding() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch("/merchants/me").then((m) =>
      setForm({
        logoUrl: m.logo_url || "",
        brandColor: m.brand_color || DEFAULT_COLOR,
      })
    );
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiFetch("/merchants/me/branding", {
        method: "PATCH",
        body: { logo_url: form.logoUrl || undefined, brand_color: form.brandColor || undefined },
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
      <PageHeader backTo="/dashboard/settings" title="Branding" subtitle="Shown on your hosted checkout, payment links, and invoices." />

      <div className="card" style={{ padding: 22, maxWidth: 480 }}>
        {error && <div className="badge badge-danger" style={{ marginBottom: 14 }}>{error}</div>}
        {success && <div className="badge badge-success" style={{ marginBottom: 14 }}>Saved</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Logo URL
            <input
              type="url"
              placeholder="https://your-cdn.com/logo.png"
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              style={{ marginTop: 6 }}
            />
          </label>
          {form.logoUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--color-text-faint)" }}>Preview:</div>
              <img
                src={form.logoUrl}
                alt="Logo preview"
                style={{ height: 32, maxWidth: 160, objectFit: "contain", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", padding: 4 }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          )}
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Brand color
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <input
                type="color"
                value={form.brandColor}
                onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                style={{ width: 40, height: 34, padding: 2, cursor: "pointer" }}
              />
              <input
                className="mono"
                value={form.brandColor}
                onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
