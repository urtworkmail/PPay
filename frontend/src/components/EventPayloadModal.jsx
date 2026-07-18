import { formatDate } from "../api/format";
import Modal from "./Modal";
import StatusBadge from "./StatusBadge";

export default function EventPayloadModal({ log, onClose, onResend, resending }) {
  return (
    <Modal title={log.event_type} onClose={onClose}>
      <div style={{ display: "flex", gap: 16, marginBottom: 14, fontSize: 13 }}>
        <div>
          <div style={{ color: "var(--color-text-faint)", marginBottom: 2 }}>Status</div>
          <StatusBadge status={log.status} />
        </div>
        <div>
          <div style={{ color: "var(--color-text-faint)", marginBottom: 2 }}>Response</div>
          <div>{log.response_status ?? "—"}</div>
        </div>
        <div>
          <div style={{ color: "var(--color-text-faint)", marginBottom: 2 }}>Attempts</div>
          <div>{log.attempt_count}</div>
        </div>
        <div>
          <div style={{ color: "var(--color-text-faint)", marginBottom: 2 }}>Sent</div>
          <div>{formatDate(log.created_at)}</div>
        </div>
      </div>
      <div style={{ color: "var(--color-text-faint)", fontSize: 12, marginBottom: 6 }}>Payload</div>
      <pre
        className="mono"
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          padding: 12,
          fontSize: 12,
          maxHeight: 260,
          overflow: "auto",
          margin: 0,
        }}
      >
        {JSON.stringify(log.payload, null, 2)}
      </pre>
      {onResend && (
        <button className="btn btn-secondary" style={{ width: "100%", marginTop: 16 }} onClick={onResend} disabled={resending}>
          {resending ? "Resending…" : "Resend"}
        </button>
      )}
    </Modal>
  );
}
