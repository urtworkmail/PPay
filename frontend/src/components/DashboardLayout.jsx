import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import DeveloperPanel from "./DeveloperPanel";
import HelpPanel from "./HelpPanel";
import OnboardingWidget from "./OnboardingWidget";
import TopBar from "./TopBar";
import {
  BankIcon,
  BoxIcon,
  CardIcon,
  ChartIcon,
  ChartLineIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  DatabaseIcon,
  FingerprintIcon,
  HomeIcon,
  InvoiceIcon,
  KeyIcon,
  LinkIcon,
  ListIcon,
  PercentIcon,
  RefreshIcon,
  RocketIcon,
  ShieldIcon,
  UsersIcon,
  WebhookIcon,
  WorkflowIcon,
} from "./Icons";

const TOP_ITEMS = [
  { to: "/dashboard", label: "Home", icon: HomeIcon, end: true },
  { to: "/dashboard/balances", label: "Balances", icon: BankIcon },
  { to: "/dashboard/transactions", label: "Transactions", icon: ListIcon },
  { to: "/dashboard/customers", label: "Customers", icon: UsersIcon },
  { to: "/dashboard/products", label: "Product catalog", icon: BoxIcon },
];

const SHORTCUTS = [
  { to: "/dashboard/subscriptions", label: "Subscriptions", icon: RefreshIcon },
  { to: "/dashboard/invoices", label: "Invoices", icon: InvoiceIcon },
  { to: "/dashboard/coming-soon/payments-analytics", label: "Payments Analytics", icon: ChartIcon, soon: true },
  { to: "/dashboard/payment-links", label: "Payment Links", icon: LinkIcon },
];

const PRODUCT_GROUPS = [
  {
    label: "Payments",
    items: [
      { to: "/dashboard/coming-soon/payments-analytics", label: "Analytics", icon: ChartIcon, soon: true },
      { to: "/dashboard/coming-soon/disputes", label: "Disputes", icon: InvoiceIcon, soon: true },
      { to: "/dashboard/payment-links", label: "Payment Links", icon: LinkIcon },
      { to: "/dashboard/sentinel", label: "Sentinel", icon: ShieldIcon },
    ],
  },
  {
    label: "Billing",
    items: [
      { to: "/dashboard/coming-soon/billing-overview", label: "Overview", icon: ChartIcon, soon: true },
      { to: "/dashboard/subscriptions", label: "Subscriptions", icon: RefreshIcon },
      { to: "/dashboard/invoices", label: "Invoices", icon: InvoiceIcon },
      { to: "/dashboard/coming-soon/usage-based", label: "Usage-based", icon: PercentIcon, soon: true },
      { to: "/dashboard/coming-soon/revenue-recovery", label: "Revenue Recovery", icon: RefreshIcon, soon: true },
    ],
  },
  {
    label: "Reporting",
    items: [
      { to: "/dashboard/coming-soon/reports", label: "Reports", icon: ChartIcon, soon: true },
      { to: "/dashboard/coming-soon/metrics", label: "Metrics", icon: ChartLineIcon, soon: true },
      { to: "/dashboard/coming-soon/data-management", label: "Data Management", icon: DatabaseIcon, soon: true },
      { to: "/dashboard/coming-soon/data-analysis", label: "Data Analysis", icon: ChartLineIcon, soon: true },
    ],
  },
  {
    label: "More",
    items: [
      { to: "/dashboard/coming-soon/profiles", label: "Profiles", icon: UsersIcon, soon: true },
      { to: "/dashboard/coming-soon/tax", label: "Tax", icon: PercentIcon, soon: true },
      { to: "/dashboard/coming-soon/identity", label: "Identity", icon: FingerprintIcon, soon: true },
      { to: "/dashboard/coming-soon/financial-connections", label: "Financial Connections", icon: BankIcon, soon: true },
      { to: "/dashboard/coming-soon/workflows", label: "Workflows", icon: WorkflowIcon, soon: true },
      { to: "/dashboard/coming-soon/issuing", label: "Issuing", icon: CardIcon, soon: true },
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

const COLLAPSE_STORAGE_KEY = "ppay_sidebar_collapsed";

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

function NavItem({ item, collapsed }) {
  if (collapsed) {
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        className="nav-tip-anchor"
        style={({ isActive }) => ({
          ...itemStyle({ isActive }),
          justifyContent: "center",
          padding: "7px 0",
        })}
      >
        {item.icon && <item.icon width={16} height={16} />}
        <span className="nav-tip">
          {item.label}
          {item.soon ? " · Soon" : ""}
        </span>
      </NavLink>
    );
  }
  return (
    <NavLink key={item.to} to={item.to} end={item.end} style={itemStyle}>
      {item.icon && <item.icon width={15} height={15} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
      {item.soon && <SoonBadge />}
    </NavLink>
  );
}

function CollapsibleGroup({ group, collapsed }) {
  const [open, setOpen] = useState(false);

  if (collapsed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {group.items.map((item) => (
          <NavItem key={item.to + item.label} item={item} collapsed />
        ))}
      </div>
    );
  }

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
  const [helpOpen, setHelpOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: collapsed ? 60 : 228,
          flexShrink: 0,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: collapsed ? "14px 8px" : "14px 10px",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
          overflowX: "visible",
          transition: "width 0.15s ease, padding 0.15s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "3px 8px",
            marginBottom: 16,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
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
              flexShrink: 0,
            }}
          >
            P
          </div>
          {!collapsed && (
            <>
              <span style={{ fontWeight: 700, fontSize: 14 }}>PPay</span>
              <span className="badge badge-pending" style={{ marginLeft: "auto", fontSize: 10 }}>
                Sandbox
              </span>
            </>
          )}
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {TOP_ITEMS.map((item) => (
              <NavItem key={item.to} item={item} collapsed={collapsed} />
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
            {!collapsed && <SectionLabel>Shortcuts</SectionLabel>}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {SHORTCUTS.map((item) => (
                <NavItem key={item.to + item.label} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
            {!collapsed && <SectionLabel>Products</SectionLabel>}
            <div style={{ display: "flex", flexDirection: "column", gap: collapsed ? 8 : 1 }}>
              {PRODUCT_GROUPS.map((group) => (
                <CollapsibleGroup key={group.label} group={group} collapsed={collapsed} />
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
            {!collapsed && <SectionLabel>Developers</SectionLabel>}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {DEVELOPERS.map((item) => (
                <NavItem key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
            {!collapsed && <SectionLabel>Account</SectionLabel>}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {ACCOUNT.map((item) => (
                <NavItem key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        </nav>

        <button
          onClick={() => setCollapsed((v) => !v)}
          className="nav-tip-anchor"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 8,
            marginTop: 10,
            padding: "7px 10px",
            background: "none",
            border: "none",
            borderTop: "1px solid var(--color-border)",
            color: "var(--color-text-faint)",
            cursor: "pointer",
            fontSize: 12.5,
          }}
        >
          <ChevronLeftIcon width={14} height={14} style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
          {!collapsed && "Collapse"}
          {collapsed && <span className="nav-tip">Expand sidebar</span>}
        </button>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <TopBar onOpenHelp={() => setHelpOpen(true)} />
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
          <div style={{ maxWidth: 1120, width: "100%" }}>
            <Outlet />
          </div>
        </main>
        <DeveloperPanel />
      </div>

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
      <OnboardingWidget />
    </div>
  );
}
