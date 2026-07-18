import { useState } from "react";

export default function CodeBlock({ samples, label }) {
  const langs = Object.keys(samples);
  const [active, setActive] = useState(langs[0]);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(samples[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card" style={{ margin: "14px 0", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 14px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg)",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {langs.map((lang) => (
            <button
              key={lang}
              onClick={() => setActive(lang)}
              style={{
                background: active === lang ? "var(--color-surface)" : "transparent",
                border: "none",
                borderRadius: "var(--radius-sm)",
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: active === lang ? "var(--color-text)" : "var(--color-text-muted)",
                cursor: "pointer",
              }}
            >
              {lang}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          style={{ background: "none", border: "none", color: "var(--color-accent)", fontSize: 12, cursor: "pointer", padding: 0 }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {label && (
        <div style={{ padding: "8px 14px 0", fontSize: 11.5, color: "var(--color-text-faint)" }}>{label}</div>
      )}
      <pre
        className="mono"
        style={{
          margin: 0,
          padding: 16,
          fontSize: 12.5,
          lineHeight: 1.6,
          overflowX: "auto",
          whiteSpace: "pre",
          color: "var(--color-text)",
        }}
      >
        {samples[active]}
      </pre>
    </div>
  );
}
