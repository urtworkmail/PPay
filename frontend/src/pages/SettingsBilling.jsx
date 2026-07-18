import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import PageHeader from "../components/PageHeader";

export default function SettingsBilling() {
  const [footer, setFooter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch("/merchants/me")
      .then((m) => setFooter(m.invoice_footer || ""))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiFetch("/merchants/me/billing", { method: "PATCH", body: { invoice_footer: footer || undefined } });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <PageHeader backTo="/dashboard/settings" title="Billing" subtitle="Invoices, subscriptions, and how they're presented to customers." />

      <div className="card" style={{ padding: 22, maxWidth: 520, marginBottom: 20 }}>
        {error && <div className="badge badge-danger" style={{ marginBottom: 14 }}>{error}</div>}
        {success && <div className="badge badge-success" style={{ marginBottom: 14 }}>Saved</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Invoice footer
            <textarea
              rows={4}
              placeholder="Thank you for your business. Payment is due within the stated terms."
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              style={{ marginTop: 6, width: "100%", resize: "vertical", fontFamily: "inherit" }}
            />
            <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 4 }}>
              Shown at the bottom of every invoice you send.
            </div>
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 22, maxWidth: 520 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Subscription billing</div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
          Renewals are attempted automatically each billing cycle. A failed renewal retries up to 3 times before the
          subscription is marked unpaid — see the{" "}
          <a href="/docs/subscriptions" target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)" }}>
            Subscriptions docs
          </a>{" "}
          for the exact schedule. There's no separate configuration for this yet.
        </p>
      </div>
    </div>
  );
}
