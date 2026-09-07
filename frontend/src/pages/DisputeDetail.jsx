import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate } from "../api/format";
import { formatMinorAmount } from "../api/format";
import PageHeader from "../components/PageHeader";
import { Field, SectionCard } from "../components/DetailKit";
import StatusBadge from "../components/StatusBadge";

export default function DisputeDetail() {
  const { id } = useParams();
  const [dispute, setDispute] = useState(null);
  const [error, setError] = useState(null);
  const [evidenceText, setEvidenceText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch(`/disputes/${id}`)
      .then(setDispute)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitEvidence(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const updated = await apiFetch(`/disputes/${id}/respond`, { method: "POST", body: { evidence_text: evidenceText } });
      setDispute(updated);
      setEvidenceText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !dispute) {
    return (
      <div>
        <PageHeader backTo="/dashboard/disputes" title="Dispute" />
        <div className="badge badge-danger" style={{ padding: "10px 12px" }}>{error}</div>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div>
        <PageHeader backTo="/dashboard/disputes" title="Dispute" />
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      </div>
    );
  }

  const daysLeft = dispute.evidence_due_by
    ? Math.ceil((new Date(dispute.evidence_due_by).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div>
      <PageHeader
        backTo="/dashboard/disputes"
        title={`Dispute for ${formatMinorAmount(dispute.amount_minor, "PKR")}`}
        subtitle={dispute.gateway_reference ? `Against payment ${dispute.gateway_reference}` : undefined}
        actions={<StatusBadge status={dispute.status} />}
      />

      {error && <div className="badge badge-danger" style={{ marginBottom: 16, padding: "10px 12px" }}>{error}</div>}

      {dispute.status === "needs_response" && daysLeft !== null && (
        <div
          className={daysLeft <= 2 ? "badge badge-danger" : "badge badge-pending"}
          style={{ marginBottom: 16, padding: "10px 12px", display: "block" }}
        >
          {daysLeft > 0
            ? `Respond within ${daysLeft} day${daysLeft === 1 ? "" : "s"} (by ${formatDate(dispute.evidence_due_by)}).`
            : "Response window has passed."}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
        <div>
          {dispute.status === "needs_response" ? (
            <SectionCard title="Submit your response">
              <div style={{ padding: 18 }}>
                <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 0 }}>
                  Explain why this charge is legitimate — proof of delivery, communication with the customer, or
                  anything else that supports your case.
                </p>
                <form onSubmit={submitEvidence} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <textarea
                    required
                    minLength={10}
                    rows={6}
                    value={evidenceText}
                    onChange={(e) => setEvidenceText(e.target.value)}
                    placeholder="Describe the evidence supporting this transaction…"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      color: "var(--color-text)",
                      fontFamily: "inherit",
                      fontSize: 13.5,
                      resize: "vertical",
                    }}
                  />
                  <button className="btn btn-primary" type="submit" disabled={submitting} style={{ alignSelf: "flex-start" }}>
                    {submitting ? "Submitting…" : "Submit response"}
                  </button>
                </form>
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="Your response">
              <div style={{ padding: 18 }}>
                {dispute.evidence_details?.text ? (
                  <>
                    <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 10px", whiteSpace: "pre-wrap" }}>
                      {dispute.evidence_details.text}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--color-text-faint)", margin: 0 }}>
                      Submitted {formatDate(dispute.evidence_submitted_at)}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>No response was submitted.</p>
                )}
              </div>
            </SectionCard>
          )}
        </div>

        <SectionCard title="Details">
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Amount" value={formatMinorAmount(dispute.amount_minor, "PKR")} />
            <Field label="Reason" value={dispute.reason ?? "Not specified"} />
            <Field label="Status" value={<StatusBadge status={dispute.status} />} />
            <Field label="Raised" value={formatDate(dispute.created_at)} />
            <Field label="Respond by" value={dispute.evidence_due_by ? formatDate(dispute.evidence_due_by) : "—"} />
            {dispute.gateway_reference && (
              <Field label="Payment reference" value={<span className="mono" style={{ fontSize: 12 }}>{dispute.gateway_reference}</span>} />
            )}
            {dispute.transaction_id && (
              <Field
                label="Transaction"
                value={
                  <Link to={`/dashboard/transactions/${dispute.transaction_id}`} style={{ color: "var(--color-accent)" }}>
                    View transaction →
                  </Link>
                }
              />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
