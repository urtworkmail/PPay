import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import PageHeader from "../components/PageHeader";

const SCHEDULES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function SettingsPayout() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch("/merchants/me").then((m) =>
      setForm({
        bankName: m.payout_bank_name || "",
        bankAccountNumber: m.payout_bank_account_number || "",
        payoutSchedule: m.payout_schedule || "weekly",
      })
    );
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiFetch("/merchants/me/payout", {
        method: "PATCH",
        body: {
          payout_bank_name: form.bankName,
          payout_bank_account_number: form.bankAccountNumber,
          payout_schedule: form.payoutSchedule,
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
      <PageHeader backTo="/dashboard/settings" title="Payout account" subtitle="Where settled funds are sent, and how often." />

      <div className="card" style={{ padding: 22, maxWidth: 480 }}>
        {error && <div className="badge badge-danger" style={{ marginBottom: 14 }}>{error}</div>}
        {success && <div className="badge badge-success" style={{ marginBottom: 14 }}>Saved</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Settlement bank name
            <input required value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Bank account / IBAN number
            <input required className="mono" value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Payout schedule
            <select value={form.payoutSchedule} onChange={(e) => setForm({ ...form, payoutSchedule: e.target.value })} style={{ marginTop: 6 }}>
              {SCHEDULES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
