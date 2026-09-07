import { Link } from "react-router-dom";
import AuthShowcase from "./AuthShowcase";

/** Split-screen shell for every auth flow (login, signup, verify, reset).
 *
 *  Left: the form, in a fixed-width column so it reads the same regardless of
 *  window size. Right: what's new, what's built, and a preview of the
 *  dashboard — filled in below the fold on narrow screens rather than hidden,
 *  since it's real product information, not decoration.
 */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap" }}>
      <div
        style={{
          flex: "1 1 420px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 40px",
          background: "var(--color-surface)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 360, margin: "0 auto" }}>
          <Link
            to="/"
            style={{ display: "inline-flex", alignItems: "center", gap: 9, marginBottom: 36, textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "var(--color-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              P
            </div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>PPay</span>
          </Link>

          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", margin: "0 0 26px" }}>{subtitle}</p>}
          {children}
        </div>
      </div>

      <div
        style={{
          flex: "1.3 1 480px",
          background: "var(--color-bg)",
          borderLeft: "1px solid var(--color-border)",
          padding: "56px 40px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <AuthShowcase />
      </div>
    </div>
  );
}
