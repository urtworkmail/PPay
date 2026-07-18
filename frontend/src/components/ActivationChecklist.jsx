import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";

function ChecklistRow({ item }) {
  return (
    <Link
      to={item.settings_path}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 4px",
        textDecoration: "none",
        color: "var(--color-text)",
        fontSize: 13,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          background: item.complete ? "var(--color-success-soft)" : "var(--color-bg)",
          color: item.complete ? "var(--color-success)" : "var(--color-text-faint)",
          border: item.complete ? "none" : "1.5px solid var(--color-border)",
        }}
      >
        {item.complete ? "✓" : ""}
      </span>
      <span style={{ flex: 1, color: item.complete ? "var(--color-text-muted)" : "var(--color-text)" }}>{item.label}</span>
      {!item.complete && <span style={{ color: "var(--color-accent)", fontSize: 12 }}>Fix →</span>}
    </Link>
  );
}

export default function ActivationChecklist() {
  const [checklist, setChecklist] = useState(null);

  useEffect(() => {
    apiFetch("/merchants/me/activation-checklist")
      .then(setChecklist)
      .catch(() => setChecklist(null));
  }, []);

  if (!checklist) return null;

  const required = checklist.items.filter((i) => i.required);
  const recommended = checklist.items.filter((i) => !i.required);

  return (
    <div className="card" style={{ padding: 20, marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Activate your account</div>
        <span className={`badge ${checklist.ready ? "badge-success" : "badge-pending"}`}>
          {checklist.ready ? "Ready for Go-Live review" : "Incomplete"}
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", margin: "0 0 12px" }}>
        Required before you can accept real payments:
      </p>
      <div style={{ marginBottom: 16 }}>
        {required.map((item) => (
          <ChecklistRow key={item.key} item={item} />
        ))}
      </div>
      <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", margin: "0 0 12px" }}>Recommended:</p>
      <div>
        {recommended.map((item) => (
          <ChecklistRow key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}
