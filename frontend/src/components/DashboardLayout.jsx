import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  BankIcon,
  HelpIcon,
  HomeIcon,
  InvoiceIcon,
  KeyIcon,
  LinkIcon,
  ListIcon,
  MonitorIcon,
  MoonIcon,
  RocketIcon,
  SunIcon,
  UsersIcon,
  WebhookIcon,
} from "./Icons";

const NAV_SECTIONS = [
  {
    label: "Home",
    items: [{ to: "/dashboard", label: "Overview", icon: HomeIcon, end: true }],
  },
  {
    label: "Payments",
    items: [
      { to: "/dashboard/transactions", label: "Transactions", icon: ListIcon },
      { to: "/dashboard/payment-links", label: "Payment Links", icon: LinkIcon },
      { to: "/dashboard/invoices", label: "Billing", icon: InvoiceIcon },
      { to: "/dashboard/customers", label: "Customers", icon: UsersIcon },
    ],
  },
  {
    label: "Developers",
    items: [
      { to: "/dashboard/api-keys", label: "API Keys", icon: KeyIcon },
      { to: "/dashboard/webhooks", label: "Webhooks", icon: WebhookIcon },
    ],
  },
  {
    label: "Finance",
    items: [{ to: "/dashboard/settlements", label: "Settlements", icon: BankIcon }],
  },
  {
    label: "Account",
    items: [
      { to: "/dashboard/team", label: "Team", icon: UsersIcon },
      { to: "/dashboard/go-live", label: "Go Live", icon: RocketIcon },
      { to: "/dashboard/help", label: "Help Center", icon: HelpIcon },
    ],
  },
];

const THEME_ICONS = { light: SunIcon, dark: MoonIcon, system: MonitorIcon };

function ThemeToggle() {
  const { mode, cycleTheme } = useTheme();
  const Icon = THEME_ICONS[mode];
  return (
    <button
      onClick={cycleTheme}
      title={`Theme: ${mode} (click to change)`}
      aria-label="Toggle theme"
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        color: "var(--color-text-muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <Icon width={16} height={16} />
    </button>
  );
}

export default function DashboardLayout() {
  const { merchant, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const initials = (merchant?.business_name || "?").slice(0, 1).toUpperCase();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 232,
          flexShrink: 0,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: "20px 14px",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 24 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: "var(--color-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            P
          </div>
          <span style={{ fontWeight: 700, fontSize: 15.5 }}>PPay</span>
          <span className="badge badge-pending" style={{ marginLeft: "auto", fontSize: 11 }}>
            Sandbox
          </span>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--color-text-faint)",
                  padding: "0 10px",
                  marginBottom: 6,
                }}
              >
                {section.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    style={({ isActive }) => ({
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "7px 10px",
                      borderRadius: 7,
                      fontSize: 13.5,
                      fontWeight: 500,
                      textDecoration: "none",
                      color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
                      background: isActive ? "var(--color-accent-soft)" : "transparent",
                    })}
                  >
                    <item.icon />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 10 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "var(--color-accent-soft)",
                color: "var(--color-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {merchant?.business_name}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--color-text-faint)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {merchant?.email}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12.5, padding: "7px 10px" }} onClick={handleLogout}>
              Log out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "32px 40px", maxWidth: 1120, width: "100%" }}>
        <Outlet />
      </main>
    </div>
  );
}
