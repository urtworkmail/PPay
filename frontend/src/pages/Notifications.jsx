import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import PageHeader from "../components/PageHeader";
import { NotificationRow, categoryLabel } from "../components/NotificationPanel";
import { BellIcon, CheckIcon, SettingsIcon } from "../components/Icons";

const PAGE_SIZE = 25;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "payment", label: "Payments" },
  { key: "security", label: "Security" },
  { key: "team", label: "Team" },
  { key: "account", label: "Account" },
];

export default function Notifications() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (filter === "unread") params.set("unread_only", "true");
      else if (filter !== "all") params.set("category", filter);
      setData(await apiFetch(`/notifications?${params}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function markAllRead() {
    await apiFetch("/notifications/read-all", { method: "POST" });
    load();
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Every change on your account, newest first."
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            {data?.unread > 0 && (
              <button className="btn btn-secondary" onClick={markAllRead} style={{ padding: "8px 14px", fontSize: 13 }}>
                <CheckIcon width={14} height={14} /> Mark all read
              </button>
            )}
            <Link
              to="/dashboard/settings/notifications"
              className="btn btn-secondary"
              style={{ padding: "8px 14px", fontSize: 13, textDecoration: "none" }}
            >
              <SettingsIcon width={14} height={14} /> Email settings
            </Link>
          </div>
        }
      />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
                background: active ? "var(--color-accent)" : "var(--color-surface)",
                color: active ? "#fff" : "var(--color-text-muted)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {f.label}
              {f.key === "unread" && data?.unread > 0 ? ` (${data.unread})` : ""}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="badge badge-danger" style={{ marginBottom: 14, padding: "10px 12px" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 6, minHeight: 200 }}>
        {loading && !data ? (
          <div style={{ padding: 24, fontSize: 13, color: "var(--color-text-muted)" }}>Loading…</div>
        ) : data?.items.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <BellIcon width={26} height={26} style={{ color: "var(--color-text-faint)" }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>Nothing here</div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
              {filter === "all"
                ? "Activity on your account will show up here."
                : `No ${filter === "unread" ? "unread" : categoryLabel(filter).toLowerCase()} notifications.`}
            </div>
          </div>
        ) : (
          data?.items.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onClick={() => navigate(`/dashboard/notifications/${notification.id}`)}
            />
          ))
        )}
      </div>

      {data && data.total > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, fontSize: 13 }}>
          <button
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: 12.5 }}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span style={{ color: "var(--color-text-muted)" }}>
            Page {page} of {totalPages} · {data.total} total
          </span>
          <button
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: 12.5 }}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
