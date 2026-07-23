import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { ChevronDownIcon, RocketIcon, XIcon } from "./Icons";

function ChecklistRow({ item, onNavigate }) {
  return (
    <button
      onClick={() => onNavigate(item.settings_path)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: "100%",
        padding: "10px 4px",
        background: "none",
        border: "none",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 17,
          height: 17,
          marginTop: 1,
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
      <span>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: item.complete ? "var(--color-text-muted)" : "var(--color-text)",
            textDecoration: item.complete ? "line-through" : "none",
          }}
        >
          {item.label}
        </div>
        {!item.complete && (
          <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 1 }}>
            {item.required ? "Required to accept real payments" : "Recommended"}
          </div>
        )}
      </span>
    </button>
  );
}

export default function OnboardingWidget() {
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    apiFetch("/merchants/me/activation-checklist")
      .then(setChecklist)
      .catch(() => setChecklist(null));
  }, []);

  if (!checklist) return null;
  const total = checklist.items.length;
  const done = checklist.items.filter((i) => i.complete).length;
  if (done === total) return null;

  function goTo(path) {
    setExpanded(false);
    navigate(path);
  }

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 80 }}>
      {expanded && (
        <div
          className="card"
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            right: 0,
            width: 340,
            maxHeight: 460,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 12px 32px rgba(0,0,0,0.16)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Activate your account</div>
              <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 1 }}>
                {done} of {total} done
              </div>
            </div>
            <button
              onClick={() => setExpanded(false)}
              aria-label="Minimize"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4, display: "flex" }}
            >
              <ChevronDownIcon width={15} height={15} />
            </button>
          </div>

          <div style={{ padding: "2px 6px", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ height: 4, background: "var(--color-bg)", borderRadius: 999, margin: "8px 10px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${(done / total) * 100}%`,
                  background: "var(--color-accent)",
                  borderRadius: 999,
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>

          <div style={{ overflowY: "auto", padding: "4px 16px 12px" }}>
            {checklist.items.map((item) => (
              <ChecklistRow key={item.key} item={item} onNavigate={goTo} />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="btn btn-primary"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderRadius: 999,
          boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
          fontSize: 13,
        }}
      >
        {expanded ? <XIcon width={14} height={14} /> : <RocketIcon width={14} height={14} />}
        Setup guide ({done}/{total})
      </button>
    </div>
  );
}
