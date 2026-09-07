import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatRelativeTime } from "../api/format";
import PageHeader from "../components/PageHeader";
import { Field, SectionCard } from "../components/DetailKit";
import { categoryLabel, severityColor } from "../components/NotificationPanel";

const SEVERITY_BADGE = {
  info: "badge-neutral",
  success: "badge-success",
  warning: "badge-pending",
  critical: "badge-danger",
};

export default function NotificationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notification, setNotification] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Opening the detail page is what marks it read — the same POST returns
    // the notification, so this is one round trip, not a read followed by a
    // separate acknowledgement.
    apiFetch(`/notifications/${id}/read`, { method: "POST" })
      .then((data) => !cancelled && setNotification(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function markUnread() {
    const updated = await apiFetch(`/notifications/${id}/unread`, { method: "POST" });
    setNotification(updated);
  }

  if (error) {
    return (
      <div>
        <PageHeader backTo="/dashboard/notifications" title="Notification" />
        <div className="badge badge-danger" style={{ padding: "10px 12px" }}>
          {error}
        </div>
      </div>
    );
  }

  if (!notification) {
    return (
      <div>
        <PageHeader backTo="/dashboard/notifications" title="Notification" />
        <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Loading…</div>
      </div>
    );
  }

  const changeEntries = Object.entries(notification.changes ?? {});

  return (
    <div>
      <PageHeader
        backTo="/dashboard/notifications"
        title={notification.title}
        subtitle={`${formatDate(notification.created_at)} · ${formatRelativeTime(notification.created_at)}`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: 13 }} onClick={markUnread}>
              Mark unread
            </button>
            {notification.link && (
              <button
                className="btn btn-primary"
                style={{ padding: "8px 14px", fontSize: 13 }}
                onClick={() => navigate(notification.link)}
              >
                Go to {categoryLabel(notification.category).toLowerCase()}
              </button>
            )}
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
        <SectionCard title="What happened">
          <div style={{ padding: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
                paddingBottom: 14,
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: severityColor(notification.severity),
                  flexShrink: 0,
                }}
              />
              <span className={`badge ${SEVERITY_BADGE[notification.severity] ?? "badge-neutral"}`}>
                {notification.severity}
              </span>
              <span className="badge" style={{ background: "var(--color-bg)", color: "var(--color-text-muted)" }}>
                {categoryLabel(notification.category)}
              </span>
              <span
                className={`badge ${notification.read_at ? "badge-neutral" : "badge-pending"}`}
                style={{ marginLeft: "auto" }}
              >
                {notification.read_at ? "Read" : "Unread"}
              </span>
            </div>

            <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{notification.body}</p>

            {changeEntries.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="section-title" style={{ marginBottom: 10 }}>
                  Details
                </div>
                <table>
                  <tbody>
                    {changeEntries.map(([key, value]) => (
                      <tr key={key}>
                        <td style={{ width: 180, color: "var(--color-text-muted)", textTransform: "capitalize" }}>
                          {key.replace(/_/g, " ")}
                        </td>
                        <td className="mono" style={{ wordBreak: "break-word" }}>
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Context">
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Triggered by" value={notification.actor_email ?? "System"} />
            <Field label="Resource" value={notification.resource_type ?? "—"} />
            {notification.resource_id && (
              <Field
                label="Resource ID"
                value={<span className="mono" style={{ fontSize: 12, wordBreak: "break-all" }}>{notification.resource_id}</span>}
              />
            )}
            <Field label="Occurred" value={formatDate(notification.created_at)} />
            <Field label="Read" value={notification.read_at ? formatDate(notification.read_at) : "Not yet"} />
            <Field
              label="Emailed"
              value={
                notification.emailed_at ? (
                  formatDate(notification.emailed_at)
                ) : (
                  <span style={{ color: "var(--color-text-muted)" }}>
                    Not emailed ·{" "}
                    <Link to="/dashboard/settings/notifications" style={{ color: "var(--color-accent)" }}>
                      change
                    </Link>
                  </span>
                )
              }
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
