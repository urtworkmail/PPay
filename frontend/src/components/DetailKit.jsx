import { useNavigate } from "react-router-dom";
import { ChevronDownIcon } from "./Icons";

export function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div style={{ fontSize: 13 }}>{value ?? "—"}</div>
    </div>
  );
}

export function SectionCard({ title, action, children, style }) {
  return (
    <div className="card" style={style}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--color-border)" }}>
          <div className="section-title">{title}</div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function RelatedRow({ icon, label, sublabel, to, onClick }) {
  const navigate = useNavigate();
  return (
    <div className="related-row" onClick={onClick ?? (() => navigate(to))}>
      {icon && <div className="related-row-icon">{icon}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        {sublabel && (
          <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sublabel}
          </div>
        )}
      </div>
      <ChevronDownIcon width={13} height={13} style={{ transform: "rotate(-90deg)", color: "var(--color-text-faint)", flexShrink: 0 }} />
    </div>
  );
}

export function RelatedCard({ title = "Related", rows }) {
  const visible = rows.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <SectionCard title={title}>
      {visible.map((row, i) => (
        <RelatedRow key={i} {...row} />
      ))}
    </SectionCard>
  );
}
