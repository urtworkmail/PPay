import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(businessName, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create your PPay account" subtitle="Start in sandbox mode, free — no live processing yet.">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && (
          <div className="badge badge-danger" style={{ width: "100%", padding: "10px 12px" }}>
            {error}
          </div>
        )}
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          Business name
          <input
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </label>
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginTop: 6 }}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 8 }}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 20, textAlign: "center" }}>
        Already have an account? <Link to="/login" style={{ color: "var(--color-accent)", fontWeight: 600 }}>Log in</Link>
      </p>
    </AuthLayout>
  );
}
