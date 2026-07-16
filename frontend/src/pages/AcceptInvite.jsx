import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch, setTokens } from "../api/client";
import AuthLayout from "../components/AuthLayout";

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [context, setContext] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch(`/team/invite/${token}`, { auth: false })
      .then(setContext)
      .catch((err) => setError(err.message));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const tokens = await apiFetch("/team/accept-invite", {
        method: "POST",
        auth: false,
        body: { token, name: name || undefined, password },
      });
      setTokens(tokens.access_token, tokens.refresh_token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (error && !context) {
    return (
      <AuthLayout title="Invite not found">
        <p style={{ color: "var(--color-danger)", fontSize: 14 }}>{error}</p>
      </AuthLayout>
    );
  }

  if (!context) {
    return (
      <AuthLayout title="Loading…">
        <p style={{ color: "var(--color-text-muted)" }}>Please wait…</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={`Join ${context.business_name}`} subtitle={`Set a password for ${context.email}`}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && <div className="badge badge-danger">{error}</div>}
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Your name (optional)
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginTop: 6 }} />
        </label>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Password
          <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginTop: 6 }} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 8 }}>
          {submitting ? "Joining…" : "Accept invite"}
        </button>
      </form>
    </AuthLayout>
  );
}
