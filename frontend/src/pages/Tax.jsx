import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatMinorAmount } from "../api/format";
import PageHeader from "../components/PageHeader";

const PROVINCES = [
  { value: "punjab", label: "Punjab (PRA)" },
  { value: "sindh", label: "Sindh (SRB)" },
  { value: "khyber_pakhtunkhwa", label: "Khyber Pakhtunkhwa (KPRA)" },
  { value: "balochistan", label: "Balochistan (BRA)" },
  { value: "islamabad_capital_territory", label: "Islamabad Capital Territory (FBR)" },
];

const FILER_STATUSES = [
  { value: "unknown", label: "Not set" },
  { value: "filer", label: "Filer (on FBR's Active Taxpayer List)" },
  { value: "non_filer", label: "Non-filer" },
];

const PERIODS = [
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
  { label: "This year", value: 365 },
];

function bps(v) {
  return `${(v / 100).toFixed(1)}%`;
}

export default function Tax() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [periodDays, setPeriodDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/merchants/me/tax")
      .then((s) => {
        setSettings(s);
        setForm(s);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/merchants/me/tax/summary?period_days=${periodDays}`)
      .then((d) => !cancelled && setSummary(d))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [periodDays]);

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await apiFetch("/merchants/me/tax", { method: "PATCH", body: form });
      setSettings(updated);
      setSaved(true);
      const refreshed = await apiFetch(`/merchants/me/tax/summary?period_days=${periodDays}`);
      setSummary(refreshed);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const isConfigured = settings?.tax_province && settings?.tax_filer_status !== "unknown";

  return (
    <div>
      <PageHeader
        title="Tax"
        subtitle="Provincial Sales Tax on Services owed on PPay's fee, and your estimated withholding exposure."
      />

      <div
        className="card"
        style={{ padding: 14, marginBottom: 20, display: "flex", gap: 11, alignItems: "flex-start" }}
      >
        <span style={{ fontSize: 16 }}>⚠️</span>
        <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.55 }}>
          These figures are estimates from published provincial rates and are not a substitute for advice from a tax
          advisor or your revenue authority. PPay does not file or remit tax on your behalf — this report exists to
          help you reconcile your own filing.
        </p>
      </div>

      {error && <div className="badge badge-danger" style={{ marginBottom: 16, padding: "10px 12px" }}>{error}</div>}

      <div className="card" style={{ padding: 22, maxWidth: 560, marginBottom: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Tax registration</div>
        <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", margin: "0 0 16px" }}>
          Used only to compute the estimates below — never shared automatically with any authority.
        </p>
        {!form ? (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : (
          <form onSubmit={saveSettings} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {saved && <div className="badge badge-success">Saved</div>}
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              National Tax Number (NTN)
              <input
                value={form.national_tax_number ?? ""}
                onChange={(e) => setForm({ ...form, national_tax_number: e.target.value || null })}
                placeholder="1234567-8"
                style={{ marginTop: 6 }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Sales Tax Registration Number (STRN)
              <input
                value={form.sales_tax_registration_number ?? ""}
                onChange={(e) => setForm({ ...form, sales_tax_registration_number: e.target.value || null })}
                placeholder="03-99-9999-999-99"
                style={{ marginTop: 6 }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              Province / territory
              <select
                value={form.tax_province ?? ""}
                onChange={(e) => setForm({ ...form, tax_province: e.target.value || null })}
                style={{ marginTop: 6 }}
              >
                <option value="">Not set</option>
                {PROVINCES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              FBR filer status
              <select
                value={form.tax_filer_status ?? "unknown"}
                onChange={(e) => setForm({ ...form, tax_filer_status: e.target.value })}
                style={{ marginTop: 6 }}
              >
                {FILER_STATUSES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Tax report</div>
        <div style={{ display: "flex", gap: 6 }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              className={p.value === periodDays ? "btn btn-primary" : "btn btn-secondary"}
              style={{ padding: "6px 14px", fontSize: 13 }}
              onClick={() => setPeriodDays(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!isConfigured && (
        <div className="badge badge-pending" style={{ padding: "10px 12px", marginBottom: 16, display: "block" }}>
          Set your province and filer status above to see sales tax and withholding estimates.
        </div>
      )}

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Sales Tax on Services</div>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
              Owed on PPay's platform fee — the service value — not on your gross transaction volume.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Platform fee (taxable value)</span>
                <span className="mono">{formatMinorAmount(summary.platform_fee_minor, summary.currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Rate</span>
                <span>{summary.sales_tax_rate_bps !== null ? bps(summary.sales_tax_rate_bps) : "—"}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 10,
                  borderTop: "1px solid var(--color-border)",
                  fontWeight: 700,
                }}
              >
                <span>Estimated sales tax</span>
                <span className="mono">
                  {summary.sales_tax_minor !== null ? formatMinorAmount(summary.sales_tax_minor, summary.currency) : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Withholding tax exposure</div>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
              Illustrative only — computed on gross volume; PPay doesn't withhold or remit this.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Gross volume</span>
                <span className="mono">{formatMinorAmount(summary.gross_volume_minor, summary.currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Rate ({summary.filer_status.replace("_", " ")})</span>
                <span>{bps(summary.withholding_tax_rate_bps)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 10,
                  borderTop: "1px solid var(--color-border)",
                  fontWeight: 700,
                }}
              >
                <span>Estimated withholding</span>
                <span className="mono">
                  {summary.estimated_withholding_tax_minor !== null
                    ? formatMinorAmount(summary.estimated_withholding_tax_minor, summary.currency)
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <p style={{ fontSize: 11.5, color: "var(--color-text-faint)", marginTop: 16 }}>
          Based on {summary.transaction_count} succeeded transaction{summary.transaction_count === 1 ? "" : "s"} between{" "}
          {new Date(summary.period_start).toLocaleDateString()} and {new Date(summary.period_end).toLocaleDateString()}.
        </p>
      )}
    </div>
  );
}
