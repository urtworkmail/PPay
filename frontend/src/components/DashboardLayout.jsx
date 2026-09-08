import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import DeveloperPanel from "./DeveloperPanel";
import Modal from "./Modal";
import {
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  LifeBuoyIcon,
  LogoutIcon,
  MonitorIcon,
  MoonIcon,
  PencilIcon,
  RocketIcon,
  SettingsIcon,
  SunIcon,
  UsersIcon,
  WebhookIcon,
} from "./Icons";
import HelpPanel from "./HelpPanel";
import OnboardingWidget from "./OnboardingWidget";
import TopBar from "./TopBar";
import { ALL_NAV_ITEMS, DEVELOPERS, PRODUCT_GROUPS, SHORTCUTS, TOP_ITEMS } from "../nav/navConfig";

const COLLAPSE_STORAGE_KEY = "ppay_sidebar_collapsed";
const HELP_PINNED_STORAGE_KEY = "ppay_help_pinned";
const HELP_WIDTH_STORAGE_KEY = "ppay_help_width";
const DEV_PANEL_STORAGE_KEY = "ppay_dev_panel_open";
const SHORTCUTS_STORAGE_KEY = "ppay_shortcuts";

// The one account used for external panel/judge review. Its data is real
// sandbox data seeded to look like an established vendor's account, not a
// blank signup — the welcome modal below exists so reviewers know that
// up front rather than mistaking it for a real merchant's real activity.
const PANEL_REVIEW_EMAIL = "panel-review@silicatelabs.site";
const PANEL_WELCOME_SESSION_KEY = "ppay_panel_welcome_seen";
const DEFAULT_SHORTCUT_IDS = SHORTCUTS.map((item) => item.to);
const TOPBAR_HEIGHT = 60;
const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

// De-duplicated by `to` — Shortcuts intentionally mirrors some Products
// entries (same page, two entry points), so the raw nav list has repeats.
const UNIQUE_NAV_ITEMS = (() => {
  const seen = new Set();
  return ALL_NAV_ITEMS.filter((item) => (seen.has(item.to) ? false : (seen.add(item.to), true)));
})();

function useShortcutIds() {
  const [ids, setIds] = useState(() => {
    try {
      const raw = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_SHORTCUT_IDS;
    } catch {
      return DEFAULT_SHORTCUT_IDS;
    }
  });
  useEffect(() => {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(ids));
  }, [ids]);
  return [ids, setIds];
}

// Indentation and weight carry the nav's hierarchy: a section header sits
// flush, the items under it step in once, and anything nested inside a group
// keeps that same step but drops in opacity — so depth reads at a glance
// without every level needing its own colour.
const INDENT_STEP = 14;
const BASE_PADDING_LEFT = 11;

const itemStyle = ({ isActive, depth = 1 }) => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "7px 11px",
  paddingLeft: BASE_PADDING_LEFT + Math.min(depth, 1) * INDENT_STEP,
  borderRadius: "var(--radius-md)",
  fontSize: 13.5,
  fontWeight: isActive ? 700 : 500,
  textDecoration: "none",
  color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
  background: isActive ? "var(--color-bg)" : "transparent",
  // Third level sits at the same indent as its parent, distinguished by
  // weight of colour rather than by stepping in again.
  opacity: depth >= 2 ? 0.68 : 1,
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

// Renders at the hovered icon's real viewport position via `position: fixed`
// rather than CSS `position: absolute` relative to the icon. An absolutely
// positioned tooltip overflowing the sidebar's right edge is what caused the
// scrollable nav to grow a phantom horizontal scrollbar (any element visually
// extending past a scrolling container's edge counts toward its scrollable
// overflow, even though it's just a tooltip). Fixed positioning is computed
// from the icon's actual bounding box on hover, so it paints at the same
// spot on screen without ever being part of nav's scrollable content.
function FixedTip({ rect, children }) {
  if (!rect) return null;
  return (
    <span
      style={{
        position: "fixed",
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
        transform: "translateY(-50%)",
        background: "var(--color-text)",
        color: "var(--color-surface)",
        fontSize: 12,
        fontWeight: 600,
        padding: "5px 9px",
        borderRadius: 6,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        zIndex: 200,
      }}
    >
      {children}
    </span>
  );
}

function NavItem({ item, collapsed, depth = 1 }) {
  const [tipRect, setTipRect] = useState(null);

  if (collapsed) {
    return (
      <>
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onMouseEnter={(e) => setTipRect(e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setTipRect(null)}
          style={({ isActive }) => ({
            ...itemStyle({ isActive }),
            justifyContent: "center",
            padding: "11px 0",
            opacity: 1, // the icon rail has no hierarchy to express
          })}
        >
          {item.icon && <item.icon width={20} height={20} />}
        </NavLink>
        <FixedTip rect={tipRect}>
          {item.label}
          {item.soon ? " · Soon" : ""}
        </FixedTip>
      </>
    );
  }
  return (
    <NavLink key={item.to} to={item.to} end={item.end} style={({ isActive }) => itemStyle({ isActive, depth })}>
      {item.icon && <item.icon width={16} height={16} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
      {item.soon && <SoonBadge />}
    </NavLink>
  );
}

function CollapsibleGroup({ group, collapsed }) {
  const [open, setOpen] = useState(false);

  if (collapsed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
          padding: "7px 11px",
          paddingLeft: BASE_PADDING_LEFT + INDENT_STEP,
          background: "none",
          border: "none",
          borderRadius: "var(--radius-md)",
          fontSize: 13.5,
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
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 1 }}>
          {group.items.map((item) => (
            <NavItem key={item.to + item.label} item={item} depth={2} />
          ))}
        </div>
      )}
    </div>
  );
}

// A top-level nav section (Main menu / Shortcuts / Products / Developers)
// that can be collapsed independently, remembering its state per-section.
function CollapsibleSection({ title, storageKey, collapsed, headerExtra, children }) {
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) !== "0");

  useEffect(() => {
    localStorage.setItem(storageKey, open ? "1" : "0");
  }, [storageKey, open]);

  if (collapsed) {
    return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>;
  }

  return (
    // A closed section is just a header row, so it only needs enough room to
    // separate it from the next one — the generous gap is for when its items
    // are actually on screen.
    <div style={{ marginBottom: open ? 16 : 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, paddingRight: 4 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: 1,
            minWidth: 0,
            padding: "8px 11px",
            borderRadius: "var(--radius-md)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--color-text-faint)",
            textAlign: "left",
          }}
        >
          <ChevronDownIcon
            width={16}
            height={16}
            style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.12s ease", flexShrink: 0 }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        </button>
        {headerExtra}
      </div>
      {open && <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>{children}</div>}
    </div>
  );
}

function ShortcutsEditor({ anchorRect, selectedIds, onToggle, onClose }) {
  if (!anchorRect) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
      <div
        className="card"
        style={{
          position: "fixed",
          top: anchorRect.bottom + 6,
          left: anchorRect.left,
          width: 260,
          maxHeight: 360,
          overflowY: "auto",
          zIndex: 201,
          padding: 6,
        }}
      >
        <div
          style={{
            padding: "6px 8px 8px",
            fontSize: 10.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--color-text-faint)",
          }}
        >
          Choose shortcuts
        </div>
        {UNIQUE_NAV_ITEMS.map((item) => (
          <label
            key={item.to}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "7px 8px",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(item.to)}
              onChange={() => onToggle(item.to)}
              style={{ width: 14, height: 14, padding: 0, flexShrink: 0 }}
            />
            {item.icon && <item.icon width={14} height={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
          </label>
        ))}
      </div>
    </>
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
          width: 32,
          height: 32,
          borderRadius: 9,
          background: "var(--color-accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 700,
          fontSize: 13,
          margin: "0 auto",
        }}
      >
        {initials}
        <span className="nav-tip">{merchant?.business_name ?? "PPay"}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "4px 2px" }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: "var(--color-accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 700,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {merchant?.business_name ?? "PPay"}
        </div>
        <div style={{ fontSize: 10.5, color: isLive ? "var(--color-success)" : "var(--color-pending)", fontWeight: 600 }}>
          {isLive ? "Live mode" : "Sandbox mode"}
        </div>
      </div>
    </div>
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

function AccountMenuTrigger({ collapsed, merchant, onOpen }) {
  const initials = (merchant?.business_name || "P").slice(0, 1).toUpperCase();

  return (
    <button
      onClick={(e) => onOpen(e.currentTarget.getBoundingClientRect())}
      className="nav-tip-anchor"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: collapsed ? "6px 0" : "6px 8px",
        justifyContent: collapsed ? "center" : "flex-start",
        background: "none",
        border: "none",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
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
      {!collapsed && (
        <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {merchant?.business_name ?? "Account"}
        </span>
      )}
      {collapsed && <span className="nav-tip">{merchant?.business_name ?? "Account"}</span>}
    </button>
  );
}

function MenuRow({ icon: Icon, label, value, danger, onClick, expanded }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "8px 10px",
        background: "none",
        border: "none",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        fontSize: 13.5,
        fontWeight: 500,
        color: danger ? "var(--color-danger)" : "var(--color-text)",
        textAlign: "left",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >
      {Icon && <Icon width={15} height={15} style={{ flexShrink: 0 }} />}
      <span style={{ flex: 1 }}>{label}</span>
      {value && (
        <span style={{ color: "var(--color-text-faint)", fontSize: 12, textTransform: "capitalize" }}>{value}</span>
      )}
      {expanded !== undefined && (
        <ChevronDownIcon
          width={11}
          height={11}
          style={{ color: "var(--color-text-faint)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.12s ease" }}
        />
      )}
    </button>
  );
}

function AccountMenu({ rect, collapsed, merchant, user, mode, setMode, onClose, onNavigate, onLogout }) {
  const [themeTrayOpen, setThemeTrayOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetched when the menu opens rather than polled — this component only
  // exists while the menu is on screen.
  useEffect(() => {
    let cancelled = false;
    apiFetch("/notifications/unread-count")
      .then((data) => !cancelled && setUnreadCount(data.unread))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rect) return null;

  const width = 250;
  const left = collapsed ? rect.right + 10 : rect.left;
  const bottom = window.innerHeight - rect.top + 8;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
      <div className="card" style={{ position: "fixed", left, bottom, width, zIndex: 201, padding: 6 }}>
        <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--color-border)", marginBottom: 4 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {merchant?.business_name ?? "PPay"}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.email}
          </div>
        </div>

        <MenuRow
          icon={BellIcon}
          label="Notifications"
          value={unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : undefined}
          onClick={() => onNavigate("/dashboard/notifications")}
        />
        <MenuRow icon={MonitorIcon} label="Active sessions" onClick={() => onNavigate("/dashboard/settings/sessions")} />
        <MenuRow icon={SettingsIcon} label="Settings" onClick={() => onNavigate("/dashboard/settings")} />
        <MenuRow icon={UsersIcon} label="Team" onClick={() => onNavigate("/dashboard/team")} />
        <MenuRow icon={RocketIcon} label="Go Live" onClick={() => onNavigate("/dashboard/go-live")} />
        <MenuRow icon={LifeBuoyIcon} label="Help & Support" onClick={() => onNavigate("/dashboard/help")} />
        <MenuRow
          icon={mode === "dark" ? MoonIcon : mode === "light" ? SunIcon : MonitorIcon}
          label="Theme"
          value={mode}
          expanded={themeTrayOpen}
          onClick={() => setThemeTrayOpen((v) => !v)}
        />
        {themeTrayOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingLeft: 10, marginBottom: 2 }}>
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setMode(opt.value);
                  setThemeTrayOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  padding: "7px 10px",
                  background: "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-text)",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <opt.icon width={14} height={14} style={{ flexShrink: 0, color: "var(--color-text-muted)" }} />
                <span style={{ flex: 1 }}>{opt.label}</span>
                {mode === opt.value && <CheckIcon width={13} height={13} style={{ color: "var(--color-accent)" }} />}
              </button>
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--color-border)", margin: "4px 0" }} />
        <MenuRow icon={LogoutIcon} label="Log out" danger onClick={onLogout} />
      </div>
    </>
  );
}

export default function DashboardLayout() {
  const { merchant, user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpPinned, setHelpPinned] = useState(() => localStorage.getItem(HELP_PINNED_STORAGE_KEY) === "1");
  const [helpWidth, setHelpWidth] = useState(() => Number(localStorage.getItem(HELP_WIDTH_STORAGE_KEY)) || 400);
  const [devPanelOpen, setDevPanelOpen] = useState(() => localStorage.getItem(DEV_PANEL_STORAGE_KEY) === "1");
  const [devPanelHeight, setDevPanelHeight] = useState(37);
  const [manualCollapsed, setManualCollapsed] = useState(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  const [shortcutIds, setShortcutIds] = useShortcutIds();
  const [shortcutsEditorRect, setShortcutsEditorRect] = useState(null);
  const [accountMenuRect, setAccountMenuRect] = useState(null);
  const isPanelReviewAccount = user?.email === PANEL_REVIEW_EMAIL;
  const [showPanelWelcome, setShowPanelWelcome] = useState(
    () => isPanelReviewAccount && sessionStorage.getItem(PANEL_WELCOME_SESSION_KEY) !== "1"
  );

  function dismissPanelWelcome() {
    sessionStorage.setItem(PANEL_WELCOME_SESSION_KEY, "1");
    setShowPanelWelcome(false);
  }

  // Pinning the help panel takes over the horizontal space it needs: the
  // sidebar collapses to its icon rail and the main content narrows to make
  // room, rather than the panel just floating on top of everything.
  const helpPinnedOpen = helpPinned && helpOpen;
  const collapsed = manualCollapsed || helpPinnedOpen;

  const shortcutItems = shortcutIds.map((id) => UNIQUE_NAV_ITEMS.find((item) => item.to === id)).filter(Boolean);

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

  function toggleShortcut(to) {
    setShortcutIds((prev) => (prev.includes(to) ? prev.filter((id) => id !== to) : [...prev, to]));
  }

  function goTo(path) {
    setAccountMenuRect(null);
    navigate(path);
  }

  function handleLogout() {
    setAccountMenuRect(null);
    logout();
    navigate("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: collapsed ? 68 : 252,
          flexShrink: 0,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          padding: collapsed ? "18px 10px" : "18px 14px",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          transition: "width 0.15s ease, padding 0.15s ease",
        }}
      >
        <div style={{ marginBottom: 20, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <WorkspaceSwitcher collapsed={collapsed} />
          </div>
          {!collapsed && (
            <button
              onClick={() => setManualCollapsed((v) => !v)}
              disabled={helpPinnedOpen}
              aria-label="Collapse sidebar"
              title={helpPinnedOpen ? "Unpin the help panel to expand the sidebar" : "Collapse sidebar"}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text-faint)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: helpPinnedOpen ? "not-allowed" : "pointer",
                opacity: helpPinnedOpen ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              <ChevronLeftIcon width={13} height={13} />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={() => setManualCollapsed((v) => !v)}
            disabled={helpPinnedOpen}
            className="nav-tip-anchor"
            aria-label="Expand sidebar"
            title={helpPinnedOpen ? "Unpin the help panel to expand the sidebar" : undefined}
            style={{
              width: 28,
              height: 28,
              margin: "0 auto 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text-faint)",
              cursor: helpPinnedOpen ? "not-allowed" : "pointer",
              opacity: helpPinnedOpen ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            <ChevronLeftIcon width={13} height={13} style={{ transform: "rotate(180deg)" }} />
            <span className="nav-tip">{helpPinnedOpen ? "Unpin help to expand" : "Expand sidebar"}</span>
          </button>
        )}

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            // Expanded sections space themselves (see CollapsibleSection), so
            // the nav only supplies the icon-rail's spacing.
            gap: collapsed ? 10 : 0,
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <CollapsibleSection title="Home" storageKey="ppay_section_main" collapsed={collapsed}>
            {TOP_ITEMS.map((item) => (
              <NavItem key={item.to} item={item} collapsed={collapsed} />
            ))}
          </CollapsibleSection>

          <CollapsibleSection
            title="Shortcuts"
            storageKey="ppay_section_shortcuts"
            collapsed={collapsed}
            headerExtra={
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShortcutsEditorRect(e.currentTarget.getBoundingClientRect());
                }}
                aria-label="Edit shortcuts"
                title="Edit shortcuts"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-faint)",
                  padding: "2px 4px",
                }}
              >
                <PencilIcon width={11} height={11} />
              </button>
            }
          >
            {shortcutItems.length === 0 ? (
              !collapsed && (
                <div style={{ padding: "4px 11px", fontSize: 12, color: "var(--color-text-faint)" }}>
                  No shortcuts yet — click the pencil to add some.
                </div>
              )
            ) : (
              shortcutItems.map((item) => <NavItem key={item.to + item.label} item={item} collapsed={collapsed} />)
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Products" storageKey="ppay_section_products" collapsed={collapsed}>
            {PRODUCT_GROUPS.map((group) => (
              <CollapsibleGroup key={group.label} group={group} collapsed={collapsed} />
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Developers" storageKey="ppay_section_developers" collapsed={collapsed}>
            {DEVELOPERS.map((item) => (
              <NavItem key={item.to} item={item} collapsed={collapsed} />
            ))}
          </CollapsibleSection>
        </nav>

        <div style={{ flexShrink: 0, paddingTop: collapsed ? 6 : 10, marginTop: collapsed ? 6 : 10 }}>
          {!collapsed && <SidebarPromo merchant={merchant} />}
          <AccountMenuTrigger collapsed={collapsed} merchant={merchant} onOpen={setAccountMenuRect} />
        </div>
      </aside>

      {shortcutsEditorRect && (
        <ShortcutsEditor
          anchorRect={shortcutsEditorRect}
          selectedIds={shortcutIds}
          onToggle={toggleShortcut}
          onClose={() => setShortcutsEditorRect(null)}
        />
      )}

      {accountMenuRect && (
        <AccountMenu
          rect={accountMenuRect}
          collapsed={collapsed}
          merchant={merchant}
          user={user}
          mode={mode}
          setMode={setMode}
          onClose={() => setAccountMenuRect(null)}
          onNavigate={goTo}
          onLogout={handleLogout}
        />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <TopBar onOpenHelp={() => setHelpOpen(true)} />
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
            <div style={{ maxWidth: 1440, width: "100%" }}>
              <Outlet />
            </div>
          </main>
          {helpPinnedOpen && (
            <HelpPanel
              inline
              open={helpOpen}
              onClose={() => setHelpOpen(false)}
              pinned={helpPinned}
              onPinnedChange={setHelpPinned}
              width={helpWidth}
              onWidthChange={setHelpWidth}
            />
          )}
        </div>
        <DeveloperPanel open={devPanelOpen} onToggle={() => setDevPanelOpen((v) => !v)} onHeightChange={setDevPanelHeight} />
      </div>

      {!helpPinnedOpen && (
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
      )}
      <OnboardingWidget bottomOffset={devPanelHeight} />

      {showPanelWelcome && (
        <Modal title="Welcome, panel reviewers" onClose={dismissPanelWelcome}>
          <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", lineHeight: 1.6, marginBottom: 16 }}>
            This account is set up specifically for reviewing PPay. Every transaction, invoice, subscription, and
            dispute you'll see here is simulated sandbox data, built to look like what an established vendor's
            account would actually contain after a few months of real use — not a blank signup.
          </p>
          <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", lineHeight: 1.6, marginBottom: 20 }}>
            Nothing here is real money or a real customer. Explore freely — nothing you do in this account affects
            anyone else's.
          </p>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={dismissPanelWelcome}>
            Got it
          </button>
        </Modal>
      )}
    </div>
  );
}
