import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DeveloperPanel from "./DeveloperPanel";
import { ChevronDownIcon, ChevronLeftIcon, RocketIcon, WebhookIcon } from "./Icons";
import HelpPanel from "./HelpPanel";
import OnboardingWidget from "./OnboardingWidget";
import TopBar from "./TopBar";
import { ACCOUNT, DEVELOPERS, PRODUCT_GROUPS, SHORTCUTS, TOP_ITEMS } from "../nav/navConfig";

const COLLAPSE_STORAGE_KEY = "ppay_sidebar_collapsed";
const HELP_PINNED_STORAGE_KEY = "ppay_help_pinned";
const HELP_WIDTH_STORAGE_KEY = "ppay_help_width";
const DEV_PANEL_STORAGE_KEY = "ppay_dev_panel_open";
const TOPBAR_HEIGHT = 60;

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

function WorkspaceSwitcher({ collapsed }) {
  const { merchant } = useAuth();
  const initials = (merchant?.business_name || "P").slice(0, 1).toUpperCase();
  const isLive = merchant?.live_status === "live";

  if (collapsed) {
    return (
      <div
        className="nav-tip-anchor"
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
          fontSize: 12.5,
          margin: "0 auto",
        }}
      >
        {initials}
        <span className="nav-tip">{merchant?.business_name ?? "PPay"}</span>
      </div>
    );
  }

  return (
    <button
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "8px 9px",
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        cursor: "pointer",
        textAlign: "left",
      }}
      title="Switch mode from the top bar toggle"
    >
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
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {merchant?.business_name ?? "PPay"}
        </div>
        <div style={{ fontSize: 10.5, color: isLive ? "var(--color-success)" : "var(--color-pending)", fontWeight: 600 }}>
          {isLive ? "Live mode" : "Sandbox mode"}
        </div>
      </div>
      <ChevronDownIcon width={12} height={12} style={{ color: "var(--color-text-faint)", flexShrink: 0 }} />
    </button>
  );
}

function SidebarPromo({ merchant }) {
  if (merchant?.live_status === "live") {
    return (
      <Link
        to="/dashboard/webhooks"
        className="card"
        style={{ display: "block", padding: 12, textDecoration: "none", color: "inherit", marginBottom: 8 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <WebhookIcon width={15} height={15} style={{ color: "var(--color-accent)" }} />
          <span style={{ fontWeight: 700, fontSize: 12.5 }}>Add a webhook</span>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", margin: "0 0 8px", lineHeight: 1.4 }}>
          Get notified the moment a payment succeeds or fails.
        </p>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-accent)" }}>Set up now →</span>
      </Link>
    );
  }
  return (
    <Link
      to="/dashboard/go-live"
      className="card"
      style={{ display: "block", padding: 12, textDecoration: "none", color: "inherit", marginBottom: 8 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <RocketIcon width={15} height={15} style={{ color: "var(--color-accent)" }} />
        <span style={{ fontWeight: 700, fontSize: 12.5 }}>Accept real payments</span>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", margin: "0 0 8px", lineHeight: 1.4 }}>
        Submit your business for review to unlock live mode.
      </p>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-accent)" }}>Go Live →</span>
    </Link>
  );
}

export default function DashboardLayout() {
  const { merchant } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpPinned, setHelpPinned] = useState(() => localStorage.getItem(HELP_PINNED_STORAGE_KEY) === "1");
  const [helpWidth, setHelpWidth] = useState(() => Number(localStorage.getItem(HELP_WIDTH_STORAGE_KEY)) || 400);
  const [devPanelOpen, setDevPanelOpen] = useState(() => localStorage.getItem(DEV_PANEL_STORAGE_KEY) === "1");
  const [devPanelHeight, setDevPanelHeight] = useState(37);
  const [manualCollapsed, setManualCollapsed] = useState(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");

  // Pinning the help panel takes over the horizontal space it needs: the
  // sidebar collapses to its icon rail and the main content narrows to make
  // room, rather than the panel just floating on top of everything.
  const helpPinnedOpen = helpPinned && helpOpen;
  const collapsed = manualCollapsed || helpPinnedOpen;

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, manualCollapsed ? "1" : "0");
  }, [manualCollapsed]);
  useEffect(() => {
    localStorage.setItem(HELP_PINNED_STORAGE_KEY, helpPinned ? "1" : "0");
  }, [helpPinned]);
  useEffect(() => {
    localStorage.setItem(HELP_WIDTH_STORAGE_KEY, String(helpWidth));
  }, [helpWidth]);
  useEffect(() => {
    localStorage.setItem(DEV_PANEL_STORAGE_KEY, devPanelOpen ? "1" : "0");
  }, [devPanelOpen]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: collapsed ? 60 : 232,
          flexShrink: 0,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: collapsed ? "14px 8px" : "14px 10px",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          transition: "width 0.15s ease, padding 0.15s ease",
        }}
      >
        <div style={{ marginBottom: 14, flexShrink: 0 }}>
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>

        <nav
          style={
            collapsed
              ? // Collapsed nav-item tooltips are absolutely positioned past the
                // sidebar's right edge (see .nav-tip in global.css). Any non-visible
                // value on the other axis forces browsers to compute this axis as
                // "auto" too (CSS overflow spec), which turned that overflowing
                // tooltip content into a real horizontal scrollbar — so this mode
                // uses `overflow: visible` on both axes instead (no scrolling here,
                // but collapsed content is short enough that it isn't needed).
                { display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "visible" }
              : { display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: "auto", overflowX: "hidden" }
          }
        >
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

        <div style={{ flexShrink: 0 }}>
          {!collapsed && <SidebarPromo merchant={merchant} />}

          <button
            onClick={() => setManualCollapsed((v) => !v)}
            disabled={helpPinnedOpen}
            className="nav-tip-anchor"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={helpPinnedOpen ? "Unpin the help panel to expand the sidebar" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              width: "100%",
              gap: 8,
              padding: "7px 10px",
              background: "none",
              border: "none",
              borderTop: "1px solid var(--color-border)",
              color: "var(--color-text-faint)",
              cursor: helpPinnedOpen ? "not-allowed" : "pointer",
              fontSize: 12.5,
              opacity: helpPinnedOpen ? 0.5 : 1,
            }}
          >
            <ChevronLeftIcon width={14} height={14} style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
            {!collapsed && "Collapse"}
            {collapsed && <span className="nav-tip">{helpPinnedOpen ? "Unpin help to expand" : "Expand sidebar"}</span>}
          </button>
        </div>
      </aside>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100vh",
          overflow: "hidden",
          marginRight: helpPinnedOpen ? helpWidth : 0,
          transition: "margin-right 0.2s ease",
        }}
      >
        <TopBar onOpenHelp={() => setHelpOpen(true)} />
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
          <div style={{ maxWidth: 1120, width: "100%" }}>
            <Outlet />
          </div>
        </main>
        <DeveloperPanel open={devPanelOpen} onToggle={() => setDevPanelOpen((v) => !v)} onHeightChange={setDevPanelHeight} />
      </div>

      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        pinned={helpPinned}
        onPinnedChange={setHelpPinned}
        width={helpWidth}
        onWidthChange={setHelpWidth}
        topOffset={TOPBAR_HEIGHT}
        bottomOffset={devPanelHeight}
      />
      <OnboardingWidget bottomOffset={devPanelHeight} />
    </div>
  );
}
