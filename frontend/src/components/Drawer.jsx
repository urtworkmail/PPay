import { useEffect } from "react";
import { XIcon } from "./Icons";

/**
 * A right-side sliding panel for create/edit forms — replaces centered Modal
 * popups for data-entry flows. Deliberately does NOT close on outside click:
 * a stray click shouldn't discard a half-filled form. Only an explicit Cancel
 * (via onClose) or a successful submit should dismiss it.
 */
export default function Drawer({ title, subtitle, children, onClose, width = 440 }) {
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15, 17, 23, 0.35)" }} />
      <div
        className="card"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width,
          maxWidth: "100%",
          borderRadius: 0,
          borderTop: "none",
          borderBottom: "none",
          borderRight: "none",
          display: "flex",
          flexDirection: "column",
          animation: "drawer-slide-in 0.18s ease-out",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: "20px 24px",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              flexShrink: 0,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <XIcon width={13} height={13} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>{children}</div>
      </div>
      <style>{`
        @keyframes drawer-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
