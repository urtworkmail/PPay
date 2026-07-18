import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { DOCS_GROUPS } from "./pages";

export default function DocsLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
          padding: "0 20px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="docs-sidebar-toggle"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, display: "none", color: "var(--color-text)" }}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--color-text)" }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: "var(--color-accent)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              P
            </div>
            <span style={{ fontWeight: 700, fontSize: 14.5 }}>PPay Docs</span>
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link to="/dashboard/help" style={{ fontSize: 13, color: "var(--color-text-muted)", textDecoration: "none" }}>
            Support
          </Link>
          <Link to="/dashboard" className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>
            Dashboard
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", maxWidth: 1280, margin: "0 auto" }}>
        <div className={`docs-sidebar ${sidebarOpen ? "docs-sidebar-open" : ""}`}>
          <nav style={{ padding: "24px 16px" }}>
            {DOCS_GROUPS.map((group) => (
              <div key={group.label} style={{ marginBottom: 22 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--color-text-faint)",
                    padding: "0 10px",
                    marginBottom: 6,
                  }}
                >
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <NavLink
                    key={item.slug}
                    to={`/docs/${item.slug}`}
                    style={({ isActive }) => ({
                      display: "block",
                      padding: "7px 10px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: 13.5,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                      background: isActive ? "var(--color-accent-soft)" : "transparent",
                      textDecoration: "none",
                    })}
                  >
                    {item.title}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <main style={{ flex: 1, minWidth: 0, padding: "32px 32px 80px" }}>
          <div style={{ maxWidth: 760 }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
