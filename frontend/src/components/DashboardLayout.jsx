import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/transactions", label: "Transactions" },
  { to: "/dashboard/api-keys", label: "API Keys" },
  { to: "/dashboard/webhooks", label: "Webhooks" },
  { to: "/dashboard/settlements", label: "Settlements" },
];

export default function DashboardLayout() {
  const { merchant, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 32 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "var(--color-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            O
          </div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>OpenPay</span>
          <span className="badge badge-pending" style={{ marginLeft: "auto" }}>
            Sandbox
          </span>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                padding: "9px 12px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                background: isActive ? "var(--color-accent-soft)" : "transparent",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
          <div style={{ padding: "0 8px", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{merchant?.business_name}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-faint)" }}>{merchant?.email}</div>
          </div>
          <button className="btn btn-secondary" style={{ width: "100%" }} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "32px 40px", maxWidth: 1080 }}>
        <Outlet />
      </main>
    </div>
  );
}
