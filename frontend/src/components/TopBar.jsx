import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getBreadcrumb } from "../nav/navConfig";
import { BellIcon, HelpIcon, MoonIcon, SearchIcon, SettingsIcon, SunIcon } from "./Icons";

function Breadcrumb() {
  const location = useLocation();
  const crumbs = getBreadcrumb(location.pathname);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, flexShrink: 0, minWidth: 0 }}>
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {i > 0 && <span style={{ color: "var(--color-text-faint)" }}>/</span>}
          {c.to ? (
            <Link
              to={c.to}
              style={{
                color: "var(--color-text-muted)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {c.label}
            </Link>
          ) : (
            <span
              style={{
                fontWeight: 700,
                color: "var(--color-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 220,
              }}
            >
              {c.label}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

const RESULT_TYPE_LABEL = {
  transaction: "Transaction",
  customer: "Customer",
  invoice: "Invoice",
  payment_link: "Payment link",
};

function DropdownAnchor({ open, onClose, children, panel, panelStyle }) {
  return (
    <div style={{ position: "relative" }}>
      {children}
      {open && (
        <>
          <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
          <div
            className="card"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 320,
              maxHeight: 400,
              overflowY: "auto",
              zIndex: 61,
              padding: 6,
              ...panelStyle,
            }}
          >
            {panel}
          </div>
        </>
      )}
    </div>
  );
}

function SearchBox() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch(`/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data.results);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeoutRef.current);
  }, [query]);

  function goTo(path) {
    setOpen(false);
    setQuery("");
    navigate(path);
  }

  return (
    <div style={{ position: "relative", width: 320 }}>
      <div style={{ position: "relative" }}>
        <SearchIcon
          width={15}
          height={15}
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search transactions, customers, invoices…"
          style={{
            paddingLeft: 34,
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            fontSize: 13.5,
          }}
        />
      </div>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
          <div
            className="card"
            style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, width: "100%", maxHeight: 400, overflowY: "auto", zIndex: 61, padding: 6 }}
          >
            {loading ? (
              <div style={{ padding: 14, fontSize: 13, color: "var(--color-text-muted)" }}>Searching…</div>
            ) : results.length === 0 ? (
              <div style={{ padding: 14, fontSize: 13, color: "var(--color-text-muted)" }}>No results for "{query}"</div>
            ) : (
              results.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => goTo(r.path)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 2,
                    width: "100%",
                    padding: "9px 10px",
                    background: "none",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--color-accent)",
                      }}
                    >
                      {RESULT_TYPE_LABEL[r.type]}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.label}</div>
                  {r.sublabel && <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{r.sublabel}</div>}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function IconButton({ children, ...props }) {
  return (
    <button
      {...props}
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
        position: "relative",
        flexShrink: 0,
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch("/transactions?status=failed&page_size=1")
      .then((data) => setFailedCount(data.total))
      .catch(() => setFailedCount(0));
  }, []);

  return (
    <DropdownAnchor
      open={open}
      onClose={() => setOpen(false)}
      panel={
        failedCount > 0 ? (
          <button
            onClick={() => {
              setOpen(false);
              navigate("/dashboard/transactions?status=failed");
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 10px",
              background: "none",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontSize: 13.5,
            }}
          >
            <strong>{failedCount}</strong> failed payment{failedCount === 1 ? "" : "s"} — review transactions
          </button>
        ) : (
          <div style={{ padding: 14, fontSize: 13, color: "var(--color-text-muted)" }}>You're all caught up.</div>
        )
      }
    >
      <IconButton onClick={() => setOpen((v) => !v)} aria-label="Notifications" title="Notifications">
        <BellIcon width={16} height={16} />
        {failedCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--color-danger)",
              border: "1.5px solid var(--color-surface)",
            }}
          />
        )}
      </IconButton>
    </DropdownAnchor>
  );
}

function ProfileMenu() {
  const { merchant, user, logout } = useAuth();
  const { mode, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ThemeIcon = mode === "dark" ? MoonIcon : SunIcon;
  const initials = (merchant?.business_name || "?").slice(0, 1).toUpperCase();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <DropdownAnchor
      open={open}
      onClose={() => setOpen(false)}
      panel={
        <div>
          <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--color-border)", marginBottom: 6 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{merchant?.business_name}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{user?.email}</div>
            {user?.role && (
              <span className="badge badge-neutral" style={{ marginTop: 6, textTransform: "capitalize" }}>
                {user.role}
              </span>
            )}
          </div>
          <button
            onClick={cycleTheme}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "9px 10px",
              background: "none",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontSize: 13.5,
              textAlign: "left",
            }}
          >
            <ThemeIcon width={15} height={15} /> Theme: {mode}
          </button>
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "9px 10px",
              background: "none",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontSize: 13.5,
              textAlign: "left",
              color: "var(--color-danger)",
            }}
          >
            Log out
          </button>
        </div>
      }
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--color-accent-soft)",
          color: "var(--color-accent)",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 12.5,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {initials}
      </button>
    </DropdownAnchor>
  );
}

export default function TopBar({ onOpenHelp }) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        height: 60,
        padding: "0 24px",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <Breadcrumb />
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <SearchBox />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconButton onClick={onOpenHelp} aria-label="Help" title="Help">
          <HelpIcon width={16} height={16} />
        </IconButton>
        <NotificationsMenu />
        <IconButton onClick={() => navigate("/dashboard/settings")} aria-label="Settings" title="Settings">
          <SettingsIcon width={16} height={16} />
        </IconButton>
        <ProfileMenu />
      </div>
    </div>
  );
}
