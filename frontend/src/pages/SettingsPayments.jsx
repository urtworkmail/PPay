import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import PageHeader from "../components/PageHeader";

const METHODS = [
  { value: "card", label: "Card" },
  { value: "wallet", label: "Mobile wallet" },
  { value: "bank_transfer", label: "Bank transfer" },
];

export default function SettingsPayments() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch("/merchants/me").then((m) =>
      setForm({
        enabledMethods: m.enabled_payment_methods || [],
        termsUrl: m.checkout_terms_url || "",
        privacyUrl: m.checkout_privacy_url || "",
      })
    );
  }, []);

  function toggleMethod(value) {
    setForm((f) => ({
      ...f,
      enabledMethods: f.enabledMethods.includes(value)
        ? f.enabledMethods.filter((m) => m !== value)
        : [...f.enabledMethods, value],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiFetch("/merchants/me/payments", {
        method: "PATCH",
        body: {
          enabled_payment_methods: form.enabledMethods,
          checkout_terms_url: form.termsUrl || undefined,
          checkout_privacy_url: form.privacyUrl || undefined,
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
      <PageHeader backTo="/dashboard/settings" title="Payments" subtitle="Which payment methods you accept, and the policies shown at checkout." />

      <div className="card" style={{ padding: 22, maxWidth: 520, marginBottom: 20 }}>
        {error && <div className="badge badge-danger" style={{ marginBottom: 14 }}>{error}</div>}
        {success && <div className="badge badge-success" style={{ marginBottom: 14 }}>Saved</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Accepted payment methods</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {METHODS.map((m) => (
                <label key={m.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.enabledMethods.includes(m.value)}
                    onChange={() => toggleMethod(m.value)}
                    style={{ width: "auto" }}
                  />
                  {m.label}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 8 }}>
              A disabled method is removed from your checkout page and rejected server-side if attempted.
            </div>
          </div>

          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Terms of Service URL
            <input
              type="url"
              placeholder="https://yourbusiness.example/terms"
              value={form.termsUrl}
              onChange={(e) => setForm({ ...form, termsUrl: e.target.value })}
              style={{ marginTop: 6 }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Privacy Policy URL
            <input
              type="url"
              placeholder="https://yourbusiness.example/privacy"
              value={form.privacyUrl}
              onChange={(e) => setForm({ ...form, privacyUrl: e.target.value })}
              style={{ marginTop: 6 }}
            />
            <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 4 }}>
              Shown as links on your checkout page footer.
            </div>
          </label>

          <button className="btn btn-primary" type="submit" disabled={saving || form.enabledMethods.length === 0} style={{ alignSelf: "flex-start" }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
