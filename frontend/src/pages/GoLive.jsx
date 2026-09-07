import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";
import { formatDate } from "../api/format";
import { RocketIcon } from "../components/Icons";

const BUSINESS_TYPES = [
  { value: "unregistered", label: "Unregistered business", hint: "Owned by one person and not registered with SECP" },
  { value: "sole_proprietorship", label: "Sole proprietorship", hint: "Registered with FBR under one owner" },
  { value: "partnership", label: "Partnership / AOP", hint: "Association of persons, registered partnership deed" },
  { value: "private_limited", label: "Private limited company", hint: "Registered with SECP" },
  { value: "nonprofit", label: "Nonprofit / NGO", hint: "Registered trust, society, or nonprofit" },
];

const STEPS = [
  { key: "type", label: "Business type" },
  { key: "details", label: "Business details" },
  { key: "products", label: "Products or services" },
  { key: "representative", label: "Account representative" },
  { key: "bank", label: "Payout bank account" },
  { key: "review", label: "Review and submit" },
];

const EMPTY_FORM = {
  businessType: "unregistered",
  legalBusinessName: "",
  businessCategory: "",
  registrationNumber: "",
  nationalTaxNumber: "",
  businessAddress: "",
  websiteUrl: "",
  productDescription: "",
  representativeFullName: "",
  representativeCnic: "",
  representativeDob: "",
  representativeAddress: "",
  bankName: "",
  bankAccountNumber: "",
  contactPhone: "",
  notes: "",
  termsAccepted: false,
};

function Field({ label, children }) {
  return (
    <label style={{ fontSize: 13, fontWeight: 500, display: "block" }}>
      {label}
      {children}
    </label>
  );
}

function StepNav({ steps, currentIndex, furthestIndex, onJump }) {
  return (
    <div style={{ width: 220, flexShrink: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Verify your business</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((step, i) => {
          const done = i < furthestIndex;
          const active = i === currentIndex;
          const reachable = i <= furthestIndex;
          return (
            <button
              key={step.key}
              onClick={() => reachable && onJump(i)}
              disabled={!reachable}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 4px",
                background: "none",
                border: "none",
                textAlign: "left",
                cursor: reachable ? "pointer" : "default",
                color: active ? "var(--color-accent)" : done ? "var(--color-text)" : "var(--color-text-faint)",
                fontWeight: active ? 700 : 500,
                fontSize: 13.5,
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: `1.5px solid ${active || done ? "var(--color-accent)" : "var(--color-border)"}`,
                  background: done ? "var(--color-accent)" : "transparent",
                  color: done ? "white" : "transparent",
                  fontSize: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {done ? "✓" : ""}
              </span>
              {step.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function GoLive() {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [furthestIndex, setFurthestIndex] = useState(0);

  useEffect(() => {
    apiFetch("/merchants/me/go-live")
      .then(setRequest)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  function goNext(e) {
    e.preventDefault();
    const next = Math.min(stepIndex + 1, STEPS.length - 1);
    setStepIndex(next);
    setFurthestIndex((f) => Math.max(f, next));
  }

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function jumpTo(i) {
    setStepIndex(i);
  }

  function startResubmit() {
    // Pre-fill from the rejected request rather than making the merchant
    // retype everything that was already fine — only whatever caused the
    // rejection needs to change.
    setForm({
      businessType: request.business_type,
      legalBusinessName: request.legal_business_name,
      businessCategory: request.business_category,
      registrationNumber: request.registration_number ?? "",
      nationalTaxNumber: request.national_tax_number ?? "",
      businessAddress: request.business_address,
      websiteUrl: request.website_url ?? "",
      productDescription: request.product_description,
      representativeFullName: request.representative_full_name,
      representativeCnic: request.representative_cnic,
      representativeDob: request.representative_dob,
      representativeAddress: request.representative_address,
      bankName: request.bank_name,
      bankAccountNumber: request.bank_account_number,
      contactPhone: request.contact_phone,
      notes: request.notes ?? "",
      termsAccepted: false,
    });
    setStepIndex(0);
    setFurthestIndex(0);
    setRequest(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.termsAccepted) {
      setError("You must accept the terms to submit");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch("/merchants/me/go-live", {
        method: "POST",
        body: {
          business_type: form.businessType,
          legal_business_name: form.legalBusinessName,
          business_category: form.businessCategory,
          registration_number: form.registrationNumber || undefined,
          national_tax_number: form.nationalTaxNumber || undefined,
          business_address: form.businessAddress,
          website_url: form.websiteUrl || undefined,
          product_description: form.productDescription,
          representative_full_name: form.representativeFullName,
          representative_cnic: form.representativeCnic,
          representative_dob: form.representativeDob,
          representative_address: form.representativeAddress,
          bank_name: form.bankName,
          bank_account_number: form.bankAccountNumber,
          contact_phone: form.contactPhone,
          notes: form.notes || undefined,
          terms_accepted: form.termsAccepted,
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

  if (request) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Go Live</h1>
        <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24, maxWidth: 640 }}>
          Sandbox mode processes simulated payments only. Moving to real money requires a one-time business
          verification — similar to how PayFast, Stripe, and every licensed payment gateway onboard merchants for
          compliance with State Bank of Pakistan and FBR regulations.
        </p>
        <div className="card" style={{ padding: 24, maxWidth: 560 }}>
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
          {request.status === "rejected" && request.rejection_reason && (
            <div
              className="badge badge-danger"
              style={{ display: "block", padding: "10px 12px", marginBottom: 14, whiteSpace: "normal" }}
            >
              <strong>Reason:</strong> {request.rejection_reason}
            </div>
          )}
          {request.status === "rejected" && (
            <button className="btn btn-primary" onClick={startResubmit} style={{ marginBottom: 12 }}>
              Update and resubmit
            </button>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
            <div>
              <div style={{ color: "var(--color-text-faint)", fontSize: 12 }}>Business type</div>
              <div style={{ textTransform: "capitalize" }}>{request.business_type.replace(/_/g, " ")}</div>
            </div>
            <div>
              <div style={{ color: "var(--color-text-faint)", fontSize: 12 }}>Category</div>
              <div>{request.business_category}</div>
            </div>
            <div>
              <div style={{ color: "var(--color-text-faint)", fontSize: 12 }}>Account representative</div>
              <div>{request.representative_full_name}</div>
            </div>
            <div>
              <div style={{ color: "var(--color-text-faint)", fontSize: 12 }}>Payout bank</div>
              <div>{request.bank_name}</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 14, marginBottom: 4 }}>
            Submitted {formatDate(request.submitted_at)}
          </p>
          <p style={{ fontSize: 12.5, color: "var(--color-text-faint)", marginTop: 16 }}>
            Our compliance team manually reviews every application — cards/wallet processing does not turn on
            automatically. You'll be notified once reviewed.
          </p>
        </div>
      </div>
    );
  }

  const stepKey = STEPS[stepIndex].key;
  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Go Live</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24, maxWidth: 640 }}>
        Sandbox mode processes simulated payments only. Moving to real money requires a one-time business
        verification, one step at a time — just like PayFast, Stripe, and every licensed gateway.
      </p>

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "flex", gap: 40 }}>
        <StepNav steps={STEPS} currentIndex={stepIndex} furthestIndex={furthestIndex} onJump={jumpTo} />

        <div className="card" style={{ padding: 28, flex: 1, maxWidth: 520 }}>
          {stepKey === "type" && (
            <form onSubmit={goNext} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>What type of business is this?</div>
              <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 0 }}>
                Choose the structure that matches how your business is registered.
              </p>
              {BUSINESS_TYPES.map((bt) => (
                <label
                  key={bt.value}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    border: `1px solid ${form.businessType === bt.value ? "var(--color-accent)" : "var(--color-border)"}`,
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    background: form.businessType === bt.value ? "var(--color-accent-soft)" : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="businessType"
                    checked={form.businessType === bt.value}
                    onChange={() => setForm({ ...form, businessType: bt.value })}
                    style={{ width: "auto", marginTop: 3 }}
                  />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{bt.label}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{bt.hint}</div>
                  </div>
                </label>
              ))}
              <button className="btn btn-primary" type="submit" style={{ marginTop: 8 }}>
                Continue
              </button>
            </form>
          )}

          {stepKey === "details" && (
            <form onSubmit={goNext} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Business details</div>
              <Field label="Legal business name">
                <input required value={form.legalBusinessName} onChange={(e) => setForm({ ...form, legalBusinessName: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <Field label="Business category">
                <input required placeholder="E-commerce, SaaS, Retail…" value={form.businessCategory} onChange={(e) => setForm({ ...form, businessCategory: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <Field label="SECP registration number (optional)">
                <input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <Field label="National Tax Number / NTN (optional)">
                <input value={form.nationalTaxNumber} onChange={(e) => setForm({ ...form, nationalTaxNumber: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <Field label="Business address">
                <input required value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <Field label="Website URL (optional)">
                <input type="url" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={goBack}>
                  Back
                </button>
                <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
                  Continue
                </button>
              </div>
            </form>
          )}

          {stepKey === "products" && (
            <form onSubmit={goNext} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>What products or services will you offer?</div>
              <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 0 }}>
                We use this to make sure what you sell meets banking-partner requirements.
              </p>
              <Field label="Description">
                <textarea
                  required
                  rows={4}
                  value={form.productDescription}
                  onChange={(e) => setForm({ ...form, productDescription: e.target.value })}
                  style={{ marginTop: 6, width: "100%", padding: "9px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontFamily: "inherit", fontSize: 14 }}
                />
              </Field>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={goBack}>
                  Back
                </button>
                <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
                  Continue
                </button>
              </div>
            </form>
          )}

          {stepKey === "representative" && (
            <form onSubmit={goNext} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Verify your account representative</div>
              <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 0 }}>
                The person authorized to activate this account on your organization's behalf.
              </p>
              <Field label="Full legal name">
                <input required value={form.representativeFullName} onChange={(e) => setForm({ ...form, representativeFullName: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <Field label="CNIC number">
                <input required placeholder="00000-0000000-0" className="mono" value={form.representativeCnic} onChange={(e) => setForm({ ...form, representativeCnic: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <Field label="Date of birth">
                <input required type="date" value={form.representativeDob} onChange={(e) => setForm({ ...form, representativeDob: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <Field label="Home address">
                <input required value={form.representativeAddress} onChange={(e) => setForm({ ...form, representativeAddress: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={goBack}>
                  Back
                </button>
                <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
                  Continue
                </button>
              </div>
            </form>
          )}

          {stepKey === "bank" && (
            <form onSubmit={goNext} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Where should we send your payouts?</div>
              <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 0 }}>
                Settled funds are sent to this account once you're live.
              </p>
              <Field label="Settlement bank name">
                <input required value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <Field label="Bank account / IBAN number">
                <input required className="mono" value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <Field label="Contact phone">
                <input required value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} style={{ marginTop: 6 }} />
              </Field>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={goBack}>
                  Back
                </button>
                <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>
                  Continue
                </button>
              </div>
            </form>
          )}

          {stepKey === "review" && (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Review and submit</div>

              {[
                ["Business type", BUSINESS_TYPES.find((b) => b.value === form.businessType)?.label],
                ["Legal business name", form.legalBusinessName],
                ["Category", form.businessCategory],
                ["NTN", form.nationalTaxNumber || "—"],
                ["Business address", form.businessAddress],
                ["Account representative", form.representativeFullName],
                ["CNIC", form.representativeCnic],
                ["Payout bank", `${form.bankName} · ${form.bankAccountNumber}`],
                ["Contact phone", form.contactPhone],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-border)", fontSize: 13 }}>
                  <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
                  <span style={{ fontWeight: 500, textAlign: "right" }}>{value}</span>
                </div>
              ))}

              <Field label="Anything else we should know? (optional)">
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ marginTop: 6 }} />
              </Field>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--color-text-muted)", margin: "12px 0" }}>
                <input
                  type="checkbox"
                  checked={form.termsAccepted}
                  onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })}
                  style={{ width: "auto", marginTop: 2 }}
                />
                I certify that the information provided is complete and correct, and I'm authorized to submit this
                application on behalf of the business.
              </label>

              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={goBack}>
                  Back
                </button>
                <button className="btn btn-primary" type="submit" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? "Submitting…" : "Agree and submit"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
