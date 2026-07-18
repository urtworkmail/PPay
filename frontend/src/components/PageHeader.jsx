import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "./Icons";

export default function PageHeader({ title, subtitle, backTo, actions }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
      <div>
        {backTo && (
          <Link
            to={backTo}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "var(--color-text-muted)",
              textDecoration: "none",
              marginBottom: 10,
            }}
          >
            <ArrowLeftIcon width={14} height={14} /> Back
          </Link>
        )}
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
          {title}
        </h1>
        {subtitle && <p style={{ color: "var(--color-text-muted)", margin: 0 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
