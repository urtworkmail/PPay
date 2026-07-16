import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Log in to PPay" subtitle="Sandbox mode — no real funds are moved.">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && (
          <div className="badge badge-danger" style={{ width: "100%", padding: "10px 12px" }}>
            {error}
          </div>
        )}
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </label>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 8 }}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 20, textAlign: "center" }}>
        Don't have an account? <Link to="/register" style={{ color: "var(--color-accent)", fontWeight: 600 }}>Sign up</Link>
      </p>
    </AuthLayout>
  );
}
