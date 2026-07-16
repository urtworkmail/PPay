import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { formatDate } from "../api/format";
import { RocketIcon } from "../components/Icons";

const EMPTY_FORM = {
  legalBusinessName: "",
  businessCategory: "",
  registrationNumber: "",
  websiteUrl: "",
  bankName: "",
  bankAccountNumber: "",
  contactPhone: "",
  notes: "",
};

export default function GoLive() {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/merchants/me/go-live")
      .then(setRequest)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiFetch("/merchants/me/go-live", {
        method: "POST",
        body: {
          legal_business_name: form.legalBusinessName,
          business_category: form.businessCategory,
          registration_number: form.registrationNumber || undefined,
          website_url: form.websiteUrl || undefined,
          bank_name: form.bankName,
          bank_account_number: form.bankAccountNumber,
          contact_phone: form.contactPhone,
          notes: form.notes || undefined,
        },
      });
      setRequest(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Go Live</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24, maxWidth: 640 }}>
        Sandbox mode processes simulated payments only. Moving to real money requires a one-time business
        verification — similar to how PayFast, Stripe, and every licensed payment gateway onboard merchants for
        compliance with State Bank of Pakistan regulations.
      </p>

      {request ? (
        <div className="card" style={{ padding: 24, maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <RocketIcon width={20} height={20} style={{ color: "var(--color-accent)" }} />
            <span style={{ fontWeight: 700, fontSize: 16 }}>{request.legal_business_name}</span>
          </div>
          <div style={{ marginBottom: 12 }}>
            {request.status === "pending_review" && (
              <span className="badge badge-pending">Under review by our team</span>
            )}
            {request.status === "approved" && <span className="badge badge-success">Approved — live mode active</span>}
            {request.status === "rejected" && <span className="badge badge-danger">Application rejected</span>}
          </div>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 4 }}>
            Category: {request.business_category}
          </p>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            Submitted {formatDate(request.submitted_at)}
          </p>
          <p style={{ fontSize: 12.5, color: "var(--color-text-faint)", marginTop: 16 }}>
            Our compliance team manually reviews every application — cards/wallet processing does not turn on
            automatically. You'll be notified by email once reviewed.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card" style={{ padding: 24, maxWidth: 520, display: "flex", flexDirection: "column", gap: 14 }}>
          {error && <div className="badge badge-danger">{error}</div>}
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Legal business name
            <input required value={form.legalBusinessName} onChange={(e) => setForm({ ...form, legalBusinessName: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Business category
            <input required placeholder="E-commerce, SaaS, Retail…" value={form.businessCategory} onChange={(e) => setForm({ ...form, businessCategory: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Business registration number (optional)
            <input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Website URL (optional)
            <input type="url" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Settlement bank name
            <input required value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Bank account / IBAN number
            <input required className="mono" value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Contact phone
            <input required value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Anything else we should know? (optional)
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ marginTop: 6 }} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 4 }}>
            {submitting ? "Submitting…" : "Submit for review"}
          </button>
        </form>
      )}
    </div>
  );
}
