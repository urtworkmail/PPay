import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import {
  BankIcon,
  BoxIcon,
  ChevronDownIcon,
  HomeIcon,
  InvoiceIcon,
  KeyIcon,
  LinkIcon,
  ListIcon,
  RocketIcon,
  UsersIcon,
  WebhookIcon,
} from "./Icons";

const TOP_ITEMS = [
  { to: "/dashboard", label: "Home", icon: HomeIcon, end: true },
  { to: "/dashboard/balances", label: "Balances", icon: BankIcon },
  { to: "/dashboard/transactions", label: "Transactions", icon: ListIcon },
  { to: "/dashboard/customers", label: "Customers", icon: UsersIcon },
  { to: "/dashboard/products", label: "Product catalog", icon: BoxIcon },
];

const SHORTCUTS = [
  { to: "/dashboard/subscriptions", label: "Subscriptions" },
  { to: "/dashboard/invoices", label: "Invoices" },
  { to: "/dashboard/coming-soon/payments-analytics", label: "Payments Analytics", soon: true },
  { to: "/dashboard/payment-links", label: "Payment Links" },
];

const PRODUCT_GROUPS = [
  {
    label: "Payments",
    items: [
      { to: "/dashboard/coming-soon/payments-analytics", label: "Analytics", soon: true },
      { to: "/dashboard/coming-soon/disputes", label: "Disputes", soon: true },
      { to: "/dashboard/payment-links", label: "Payment Links" },
      { to: "/dashboard/coming-soon/risk-radar", label: "PPR (PPay Risk Radar)", soon: true },
    ],
  },
  {
    label: "Billing",
    items: [
      { to: "/dashboard/coming-soon/billing-overview", label: "Overview", soon: true },
      { to: "/dashboard/subscriptions", label: "Subscriptions" },
      { to: "/dashboard/invoices", label: "Invoices" },
      { to: "/dashboard/coming-soon/usage-based", label: "Usage-based", soon: true },
      { to: "/dashboard/coming-soon/revenue-recovery", label: "Revenue Recovery", soon: true },
    ],
  },
  {
    label: "Reporting",
    items: [
      { to: "/dashboard/coming-soon/reports", label: "Reports", soon: true },
      { to: "/dashboard/coming-soon/metrics", label: "Metrics", soon: true },
      { to: "/dashboard/coming-soon/data-management", label: "Data Management", soon: true },
      { to: "/dashboard/coming-soon/data-analysis", label: "Data Analysis", soon: true },
    ],
  },
  {
    label: "More",
    items: [
      { to: "/dashboard/coming-soon/profiles", label: "Profiles", soon: true },
      { to: "/dashboard/coming-soon/tax", label: "Tax", soon: true },
      { to: "/dashboard/coming-soon/identity", label: "Identity", soon: true },
      { to: "/dashboard/coming-soon/financial-connections", label: "Financial Connections", soon: true },
      { to: "/dashboard/coming-soon/workflows", label: "Workflows", soon: true },
      { to: "/dashboard/coming-soon/issuing", label: "Issuing", soon: true },
    ],
  },
];

const DEVELOPERS = [
  { to: "/dashboard/api-keys", label: "API Keys", icon: KeyIcon },
  { to: "/dashboard/webhooks", label: "Webhooks", icon: WebhookIcon },
  { to: "/dashboard/events", label: "Events", icon: ListIcon },
  { to: "/docs", label: "Documentation", icon: InvoiceIcon },
];

const ACCOUNT = [
  { to: "/dashboard/team", label: "Team", icon: UsersIcon },
  { to: "/dashboard/go-live", label: "Go Live", icon: RocketIcon },
];

const itemStyle = ({ isActive }) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "5px 10px",
  borderRadius: "var(--radius-sm)",
  fontSize: 13,
  fontWeight: 500,
  textDecoration: "none",
  color: isActive ? "var(--color-accent)" : "var(--color-text-muted)",
  background: isActive ? "var(--color-accent-soft)" : "transparent",
});

function SoonBadge() {
  return (
    <span
      style={{
        marginLeft: "auto",
        fontSize: 9.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        color: "var(--color-text-faint)",
        border: "1px solid var(--color-border)",
        borderRadius: 4,
        padding: "1px 5px",
        flexShrink: 0,
      }}
    >
      Soon
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--color-text-faint)",
        padding: "0 10px",
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function NavItem({ item }) {
  return (
    <NavLink key={item.to} to={item.to} end={item.end} style={itemStyle}>
      {item.icon && <item.icon width={15} height={15} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
      {item.soon && <SoonBadge />}
    </NavLink>
  );
}

function CollapsibleGroup({ group }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "5px 10px",
          background: "none",
          border: "none",
          borderRadius: "var(--radius-sm)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-text-muted)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {group.label}
        <ChevronDownIcon
          width={12}
          height={12}
          style={{ marginLeft: "auto", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.12s ease" }}
        />
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingLeft: 14, marginTop: 1 }}>
          {group.items.map((item) => (
            <NavItem key={item.to + item.label} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 228,
          flexShrink: 0,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: "14px 10px",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 8px", marginBottom: 16 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: "var(--color-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            P
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>PPay</span>
          <span className="badge badge-pending" style={{ marginLeft: "auto", fontSize: 10 }}>
            Sandbox
          </span>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {TOP_ITEMS.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
            <SectionLabel>Shortcuts</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {SHORTCUTS.map((item) => (
                <NavItem key={item.to + item.label} item={item} />
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
            <SectionLabel>Products</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {PRODUCT_GROUPS.map((group) => (
                <CollapsibleGroup key={group.label} group={group} />
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
            <SectionLabel>Developers</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {DEVELOPERS.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
            <SectionLabel>Account</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {ACCOUNT.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </div>
          </div>
        </nav>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar />
        <main style={{ padding: "32px 40px", maxWidth: 1120, width: "100%" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
