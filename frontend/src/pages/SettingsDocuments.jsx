import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatDate } from "../api/format";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

export default function SettingsDocuments() {
  const [goLive, setGoLive] = useState(null);
  const [notSubmitted, setNotSubmitted] = useState(false);

  useEffect(() => {
    apiFetch("/merchants/me/go-live")
      .then(setGoLive)
      .catch(() => setNotSubmitted(true));
  }, []);

  return (
    <div>
      <PageHeader backTo="/dashboard/settings" title="Documents & compliance" subtitle="Your verification status and what we collect, and why." />

      <div className="card" style={{ padding: 22, maxWidth: 620, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Go-Live application</div>
        {notSubmitted ? (
          <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", margin: 0 }}>
            You haven't submitted a Go-Live application yet — see the Go Live page in the sidebar to start.
          </p>
        ) : goLive ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StatusBadge status={goLive.status} />
              <span style={{ color: "var(--color-text-muted)" }}>Submitted {formatDate(goLive.submitted_at)}</span>
            </div>
            {goLive.reviewed_at && (
              <div style={{ color: "var(--color-text-muted)" }}>Reviewed {formatDate(goLive.reviewed_at)}</div>
            )}
            <div style={{ color: "var(--color-text-muted)" }}>Legal business name: {goLive.legal_business_name}</div>
          </div>
        ) : (
          <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
        )}
      </div>

      <div className="card" style={{ padding: 22, maxWidth: 620 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>What we collect, and why</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5, lineHeight: 1.6, color: "var(--color-text-muted)" }}>
          <p style={{ margin: 0 }}>
            Going live is a manual, human-reviewed step — there's no code path that auto-approves it. We collect
            business registration details, an account representative's identity information, and payout bank
            details, modeled on what a Pakistani payment gateway actually needs for regulatory compliance rather
            than fields borrowed from a US-shaped form.
          </p>
          <p style={{ margin: 0 }}>
            No real card data is ever accepted or stored by this product — the sandbox payment engine only
            recognizes a fixed, documented set of test values. Real production processing would sit behind hosted,
            tokenized card fields from a licensed acquirer, so raw card numbers would never reach our servers
            either.
          </p>
          <p style={{ margin: 0 }}>
            API keys are stored as bcrypt hashes, never in plaintext. Webhook payloads are signed with HMAC-SHA256
            so your endpoint can verify a delivery actually came from us — see the{" "}
            <a href="/docs/webhooks" target="_blank" rel="noreferrer" style={{ color: "var(--color-accent)" }}>
              webhook signing docs
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
