import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { formatDate } from "../api/format";
import { useAuth } from "../context/AuthContext";
import Drawer from "../components/Drawer";
import { PlusIcon } from "../components/Icons";

const ROLES = ["owner", "admin", "analyst", "support"];
const ROLE_DESCRIPTIONS = {
  owner: "Full access, including billing and removing other owners",
  admin: "Manage API keys, webhooks, refunds, and team members",
  analyst: "View-only access to transactions and reports",
  support: "Can issue refunds and view transactions",
};

export default function Team() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [form, setForm] = useState({ email: "", name: "", role: "analyst" });

  const canManage = user && (user.role === "owner" || user.role === "admin");

  async function load() {
    try {
      setMembers(await apiFetch("/team/members"));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    try {
      const result = await apiFetch("/team/invite", {
        method: "POST",
        body: { email: form.email, name: form.name || undefined, role: form.role },
      });
      setInviteResult(result.invite_url);
      setForm({ email: "", name: "", role: "analyst" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId, role) {
    try {
      await apiFetch(`/team/members/${memberId}/role`, { method: "PATCH", body: { role } });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(memberId) {
    try {
      await apiFetch(`/team/members/${memberId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Team</h1>
          <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
            Invite teammates to help manage payments, with role-based access.
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
            <PlusIcon width={15} height={15} /> Invite member
          </button>
        )}
      </div>

      {error && <div className="badge badge-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{m.name || m.email}</div>
                  <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{m.email}</div>
                </td>
                <td>
                  {canManage && m.id !== user?.id ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      style={{ width: "auto", padding: "5px 8px", fontSize: 13, textTransform: "capitalize" }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r} style={{ textTransform: "capitalize" }}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ textTransform: "capitalize", fontSize: 13.5 }}>{m.role}</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${m.status === "active" ? "badge-success" : "badge-pending"}`} style={{ textTransform: "capitalize" }}>
                    {m.status}
                  </span>
                </td>
                <td style={{ color: "var(--color-text-muted)" }}>{m.last_login_at ? formatDate(m.last_login_at) : "—"}</td>
                <td>
                  {canManage && m.id !== user?.id && (
                    <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: 12.5 }} onClick={() => handleRemove(m.id)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInvite && (
        <Drawer
          title="Invite a team member"
          onClose={() => {
            setShowInvite(false);
            setInviteResult(null);
          }}
        >
          {inviteResult ? (
            <div>
              <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", marginBottom: 10 }}>
                Share this invite link — it expires in 7 days:
              </p>
              <code className="mono" style={{ fontSize: 12.5, wordBreak: "break-all", display: "block", marginBottom: 16 }}>
                {inviteResult}
              </code>
              <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => { setShowInvite(false); setInviteResult(null); }}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500 }}>
                Email
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ marginTop: 6 }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 500 }}>
                Name (optional)
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ marginTop: 6 }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 500 }}>
                Role
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ marginTop: 6 }}>
                  {ROLES.filter((r) => r !== "owner").map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 4 }}>
                  {ROLE_DESCRIPTIONS[form.role]}
                </div>
              </label>
              <button className="btn btn-primary" type="submit" disabled={inviting} style={{ marginTop: 4 }}>
                {inviting ? "Sending invite…" : "Send invite"}
              </button>
            </form>
          )}
        </Drawer>
      )}
    </div>
  );
}
