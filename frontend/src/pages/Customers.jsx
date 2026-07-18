import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/customers")
      .then(setCustomers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Customers</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24 }}>
        Built automatically from customers who've completed a payment with you.
      </p>

      {error && <div className="badge badge-danger">{error}</div>}

      <div className="card">
        {loading ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : customers.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>
            No customers yet. They'll show up here once a checkout captures their email.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Total spent</th>
                <th>Transactions</th>
                <th>Subscriptions</th>
                <th>Last payment</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr
                  key={c.email}
                  onClick={() => navigate(`/dashboard/customers/${encodeURIComponent(c.email)}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{c.email}</td>
                  <td style={{ fontWeight: 600 }}>{formatMinorAmount(c.total_spent_minor, c.currency)}</td>
                  <td>{c.transaction_count}</td>
                  <td>
                    {c.subscription_count > 0 ? (
                      <span className="badge badge-success">{c.subscription_count} active</span>
                    ) : (
                      <span style={{ color: "var(--color-text-faint)" }}>—</span>
                    )}
                  </td>
                  <td style={{ color: "var(--color-text-muted)" }}>{formatDate(c.last_transaction_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
