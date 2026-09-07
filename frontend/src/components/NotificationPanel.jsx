import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatRelativeTime } from "../api/format";
import { BellIcon, CheckIcon } from "./Icons";

const SEVERITY_COLOR = {
  info: "var(--color-accent)",
  success: "var(--color-success)",
  warning: "var(--color-pending)",
  critical: "var(--color-danger)",
};

const CATEGORY_LABEL = {
  payment: "Payment",
  refund: "Refund",
  dispute: "Dispute",
  payout: "Payout",
  customer: "Customer",
  invoice: "Invoice",
  subscription: "Subscription",
  payment_link: "Payment link",
  product: "Product",
  team: "Team",
  api_key: "API key",
  webhook: "Webhook",
  security: "Security",
  account: "Account",
};

export function categoryLabel(category) {
  return CATEGORY_LABEL[category] ?? category;
}

export function severityColor(severity) {
  return SEVERITY_COLOR[severity] ?? "var(--color-text-faint)";
}

export function NotificationRow({ notification, onClick, compact = false }) {
  const unread = notification.read_at === null;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: "100%",
        padding: compact ? "10px 12px" : "14px 16px",
        background: unread ? "var(--color-bg)" : "none",
        border: "none",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        textAlign: "left",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = unread ? "var(--color-bg)" : "none")}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          marginTop: 6,
          flexShrink: 0,
          background: unread ? severityColor(notification.severity) : "transparent",
          border: unread ? "none" : "1px solid var(--color-border)",
        }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontSize: 13.5,
              fontWeight: unread ? 700 : 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {notification.title}
          </span>
          <span style={{ fontSize: 11, color: "var(--color-text-faint)", marginLeft: "auto", flexShrink: 0 }}>
            {formatRelativeTime(notification.created_at)}
          </span>
        </span>
        <span
          style={{
            display: "block",
            fontSize: 12.5,
            color: "var(--color-text-muted)",
            marginTop: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: compact ? "nowrap" : "normal",
          }}
        >
          {notification.body}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <span
            className="badge"
            style={{ background: "var(--color-bg)", color: "var(--color-text-muted)", fontSize: 10.5 }}
          >
            {categoryLabel(notification.category)}
          </span>
          {!unread && <span style={{ fontSize: 10.5, color: "var(--color-text-faint)" }}>Read</span>}
        </span>
      </span>
    </button>
  );
}

/** The bell-triggered panel: a scrollable window over the newest notifications. */
export default function NotificationPanel({ open, onClose, onUnreadChange }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/notifications?page_size=20");
      setItems(data.items);
      setUnread(data.unread);
      onUnreadChange?.(data.unread);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function openNotification(notification) {
    onClose();
    navigate(`/dashboard/notifications/${notification.id}`);
  }

  async function markAllRead() {
    await apiFetch("/notifications/read-all", { method: "POST" });
    load();
  }

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
      <div
        className="card"
        style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: 380,
          maxWidth: "calc(100vw - 32px)",
          zIndex: 61,
          padding: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: 460,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>Notifications</span>
          {unread > 0 && (
            <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>
              {unread} unread
            </span>
          )}
          {unread > 0 && (
            <button
              onClick={markAllRead}
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-accent)",
              }}
            >
              <CheckIcon width={12} height={12} /> Mark all read
            </button>
          )}
        </div>

        {/* The scrollable window itself — the header and footer stay put. */}
        <div style={{ flex: 1, overflowY: "auto", padding: 6, minHeight: 0 }}>
          {loading && items.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: "var(--color-text-muted)" }}>Loading…</div>
          ) : error ? (
            <div style={{ padding: 20, fontSize: 13, color: "var(--color-danger)" }}>{error}</div>
          ) : items.length === 0 ? (
            <div style={{ padding: "28px 20px", textAlign: "center" }}>
              <BellIcon width={22} height={22} style={{ color: "var(--color-text-faint)" }} />
              <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 8 }}>
                Nothing yet. Activity on your account shows up here.
              </div>
            </div>
          ) : (
            items.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                compact
                onClick={() => openNotification(notification)}
              />
            ))
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--color-border)", padding: 8, flexShrink: 0 }}>
          <button
            onClick={() => {
              onClose();
              navigate("/dashboard/notifications");
            }}
            style={{
              width: "100%",
              padding: "8px 10px",
              background: "none",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-accent)",
            }}
          >
            View all notifications
          </button>
        </div>
      </div>
    </>
  );
}
