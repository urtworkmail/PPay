import { useEffect, useRef, useState } from "react";
import { clearRequestLog, getRequestLog, subscribeRequestLog } from "../api/requestLog";
import { ChevronDownIcon, TerminalIcon } from "./Icons";

function statusColor(entry) {
  if (!entry.ok) return "var(--color-danger)";
  if (entry.status >= 200 && entry.status < 300) return "var(--color-success)";
  return "var(--color-text-muted)";
}

function methodColor(method) {
  return (
    {
      GET: "var(--color-accent)",
      POST: "var(--color-success)",
      PATCH: "var(--color-pending)",
      PUT: "var(--color-pending)",
      DELETE: "var(--color-danger)",
    }[method] ?? "var(--color-text-muted)"
  );
}

function RequestRow({ entry, expanded, onToggle }) {
  return (
    <div style={{ borderBottom: "1px solid var(--color-border)" }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "7px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontSize: 12,
        }}
      >
        <span style={{ color: methodColor(entry.method), fontWeight: 700, width: 46, flexShrink: 0 }}>{entry.method}</span>
        <span className="mono" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text)" }}>
          /api/v1{entry.path}
        </span>
        <span style={{ color: statusColor(entry), fontWeight: 700, width: 34, textAlign: "right", flexShrink: 0 }}>
          {entry.status || "ERR"}
        </span>
        <span style={{ color: "var(--color-text-faint)", width: 56, textAlign: "right", flexShrink: 0 }}>{entry.durationMs}ms</span>
        <span style={{ color: "var(--color-text-faint)", width: 68, textAlign: "right", flexShrink: 0 }}>
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
      </button>
      {expanded && (
        <div style={{ padding: "0 16px 12px 72px", display: "flex", flexDirection: "column", gap: 8 }}>
          {entry.requestBody !== undefined && (
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-faint)", marginBottom: 3 }}>
                Request body
              </div>
              <pre className="mono" style={{ fontSize: 11, background: "var(--color-bg)", padding: 8, borderRadius: 6, overflowX: "auto", margin: 0 }}>
                {JSON.stringify(entry.requestBody, null, 2)}
              </pre>
            </div>
          )}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-faint)", marginBottom: 3 }}>
              Response
            </div>
            <pre className="mono" style={{ fontSize: 11, background: "var(--color-bg)", padding: 8, borderRadius: 6, overflowX: "auto", margin: 0, maxHeight: 200, overflowY: "auto" }}>
              {JSON.stringify(entry.responseBody, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DeveloperPanel({ open, onToggle, onHeightChange }) {
  const [log, setLog] = useState(getRequestLog());
  const [expandedId, setExpandedId] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => subscribeRequestLog(setLog), []);

  // Reports its own real rendered height (rather than the caller guessing a
  // pixel constant) so the Help panel can size its bottom edge to sit
  // exactly on top of this bar, whatever state it's in.
  useEffect(() => {
    if (!onHeightChange || !rootRef.current) return;
    const el = rootRef.current;
    const observer = new ResizeObserver((entries) => {
      onHeightChange(entries[0].contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onHeightChange]);

  const last = log[0];

  return (
    <div
      ref={rootRef}
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        zIndex: 50,
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
        flexShrink: 0,
      }}
    >
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "7px 20px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          color: "var(--color-text-muted)",
        }}
      >
        <TerminalIcon width={14} height={14} />
        <span style={{ fontWeight: 600 }}>Developer</span>
        {last && !open && (
          <span className="mono" style={{ color: "var(--color-text-faint)" }}>
            {last.method} {last.path} · {last.status || "ERR"}
          </span>
        )}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {open && log.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                clearRequestLog();
              }}
              style={{ color: "var(--color-text-faint)", textDecoration: "underline", cursor: "pointer" }}
            >
              Clear
            </span>
          )}
          <ChevronDownIcon width={13} height={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
        </span>
      </button>

      {open && (
        <div style={{ maxHeight: 260, overflowY: "auto", borderTop: "1px solid var(--color-border)" }}>
          {log.length === 0 ? (
            <p style={{ padding: "16px 20px", fontSize: 12.5, color: "var(--color-text-muted)" }}>
              No API requests logged yet this session — navigate around the dashboard to see live request/response
              traffic here.
            </p>
          ) : (
            log.map((entry) => (
              <RequestRow
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId((id) => (id === entry.id ? null : entry.id))}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
