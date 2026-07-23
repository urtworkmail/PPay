import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDate, formatMinorAmount } from "../api/format";
import { BankIcon, BoxIcon, InvoiceIcon, KeyIcon, LinkIcon, UsersIcon, WebhookIcon } from "../components/Icons";
import PaymentsBreakdownBar from "../components/PaymentsBreakdownBar";
import StatusBadge from "../components/StatusBadge";
import TrendChart from "../components/TrendChart";
import { useAuth } from "../context/AuthContext";

const PERIODS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
];

const QUICK_ACTIONS = [
  { to: "/dashboard/payment-links", label: "Create Payment Link", icon: LinkIcon },
  { to: "/dashboard/invoices", label: "Create Invoice", icon: InvoiceIcon },
  { to: "/dashboard/products", label: "Add Product", icon: BoxIcon },
  { to: "/dashboard/api-keys", label: "API Keys", icon: KeyIcon },
  { to: "/dashboard/webhooks", label: "Add Webhook", icon: WebhookIcon },
  { to: "/dashboard/balances", label: "View Payouts", icon: BankIcon },
  { to: "/dashboard/team", label: "Invite Team Member", icon: UsersIcon },
];

function shortDate(iso) {
  return new Date(iso).toLocaleDateString("en-PK", { month: "short", day: "numeric" });
}

function initialsAvatar(email) {
  const letter = (email || "?").trim().charAt(0).toUpperCase();
  const hue = [...(email || "")].reduce((h, c) => h + c.charCodeAt(0), 0) % 6;
  const bg = [
    "var(--color-accent-soft)",
    "var(--color-success-soft)",
    "var(--color-pending-soft)",
    "var(--color-danger-soft)",
    "var(--color-accent-soft)",
    "var(--color-success-soft)",
  ][hue];
  const fg = [
    "var(--color-accent)",
    "var(--color-success)",
    "var(--color-pending)",
    "var(--color-danger)",
    "var(--color-accent)",
    "var(--color-success)",
  ][hue];
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 12.5,
        flexShrink: 0,
      }}
    >
      {letter}
    </div>
  );
}

export default function Overview() {
  const { merchant } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [periodDays, setPeriodDays] = useState(7);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiFetch("/dashboard/summary"), apiFetch("/transactions?page_size=100")])
      .then(([summaryData, txData]) => {
        if (cancelled) return;
        setSummary(summaryData);
        setRecent(txData.items);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/dashboard/analytics?period_days=${periodDays}`)
      .then((data) => !cancelled && setAnalytics(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [periodDays]);

  if (error) return <div className="badge badge-danger">{error}</div>;
  if (!summary || !analytics) return <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>;

  const grossPoints = analytics.gross_volume.map((p) => ({ date: p.date, value: p.amount_minor }));
  const netPoints = analytics.net_volume.map((p) => ({ date: p.date, value: p.amount_minor }));
  const newCustomerPoints = analytics.new_customers.map((p) => ({ date: p.date, value: p.count }));

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Overview</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 20 }}>
        Your account is in sandbox mode — all transactions below use simulated payment rails.
      </p>

      {merchant?.live_status === "sandbox_only" && (
        <div
          className="card"
          style={{
            padding: "14px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            background: "var(--color-accent-soft)",
            borderColor: "var(--color-accent)",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Ready to accept real payments?</div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Submit your business for verification to unlock live mode.
            </div>
          </div>
          <Link to="/dashboard/go-live" className="btn btn-primary" style={{ flexShrink: 0, textDecoration: "none" }}>
            Go Live
          </Link>
        </div>
      )}
      {merchant?.live_status === "pending_review" && (
        <div className="badge badge-pending" style={{ padding: "8px 14px", marginBottom: 20 }}>
          Your live access application is under review
        </div>
      )}
      {merchant?.live_status === "live" && (
        <div className="badge badge-success" style={{ padding: "8px 14px", marginBottom: 20 }}>
          Live payments enabled
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="btn btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none", padding: "8px 14px", fontSize: 13 }}
          >
            <a.icon width={14} height={14} />
            {a.label}
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 20, alignItems: "start" }}>
        <div className="card" style={{ padding: "20px 22px", alignSelf: "start", height: "fit-content" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Overview</div>
            <div style={{ display: "flex", gap: 6 }}>
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  className={p.value === periodDays ? "btn btn-primary" : "btn btn-secondary"}
                  style={{ padding: "5px 11px", fontSize: 12 }}
                  onClick={() => setPeriodDays(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Total volume</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{formatMinorAmount(summary.total_volume_minor, "PKR")}</div>
              <div style={{ fontSize: 11.5, color: "var(--color-text-faint)" }}>{summary.transaction_count} transactions, all time</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Success rate</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.success_rate}%</div>
              <div style={{ fontSize: 11.5, color: "var(--color-text-faint)" }}>
                {summary.succeeded_count} succeeded / {summary.failed_count} failed
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Fees earned by PPay</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{formatMinorAmount(summary.total_fees_minor, "PKR")}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>Pending settlement</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{formatMinorAmount(summary.pending_settlement_minor, "PKR")}</div>
              <div style={{ fontSize: 11.5, color: "var(--color-text-faint)" }}>Awaiting next batch</div>
            </div>
          </div>

          <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginBottom: 4 }}>Gross volume</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {formatMinorAmount(analytics.gross_volume_total_minor, analytics.currency)}
          </div>
          <TrendChart points={grossPoints} formatValue={(v) => formatMinorAmount(v, analytics.currency)} formatDate={shortDate} height={110} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignSelf: "start", height: "fit-content" }}>
          <div className="card">
            <div style={{ padding: "16px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Recent activity</div>
              <Link to="/dashboard/transactions" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}>
                View all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p style={{ padding: "0 18px 16px", fontSize: 12.5, color: "var(--color-text-muted)" }}>No transactions yet.</p>
            ) : (
              <div>
                {recent.slice(0, 5).map((t) => (
                  <Link
                    key={t.id}
                    to={`/dashboard/transactions/${t.id}`}
                    className="related-row"
                    style={{ textDecoration: "none", color: "inherit", padding: "10px 18px" }}
                  >
                    {initialsAvatar(t.customer_email)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.customer_email ?? "Guest"}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--color-text-faint)" }}>{formatDate(t.created_at)}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{formatMinorAmount(t.amount_minor, t.currency)}</div>
                      <StatusBadge status={t.payment_intent_status === "requires_reconciliation" ? "requires_reconciliation" : t.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ padding: "16px 18px 10px", fontWeight: 700, fontSize: 13.5 }}>Top customers</div>
            {analytics.top_customers.length === 0 ? (
              <p style={{ padding: "0 18px 16px", fontSize: 12.5, color: "var(--color-text-muted)" }}>No customer activity yet.</p>
            ) : (
              <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {analytics.top_customers.slice(0, 4).map((c) => (
                  <Link
                    key={c.email}
                    to={`/dashboard/customers/${encodeURIComponent(c.email)}`}
                    style={{ display: "flex", justifyContent: "space-between", textDecoration: "none", color: "inherit" }}
                  >
                    <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0, marginLeft: 10 }}>
                      {formatMinorAmount(c.total_spent_minor, analytics.currency)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ padding: "20px 22px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Payments</div>
          <PaymentsBreakdownBar breakdown={analytics.payments_breakdown} currency={analytics.currency} />
        </div>

        <div className="card" style={{ padding: "20px 22px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Net volume from sales</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            {formatMinorAmount(analytics.net_volume_total_minor, analytics.currency)}
          </div>
          <TrendChart
            points={netPoints}
            formatValue={(v) => formatMinorAmount(v, analytics.currency)}
            formatDate={shortDate}
            color="var(--color-success)"
            height={100}
          />
        </div>

        <div className="card" style={{ padding: "20px 22px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>New customers</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{analytics.new_customers_total}</div>
          <TrendChart
            points={newCustomerPoints}
            formatValue={(v) => `${v} new`}
            formatDate={shortDate}
            color="var(--color-accent)"
            height={100}
          />
        </div>
      </div>

      {analytics.failed_payments.length > 0 && (
        <div className="card" style={{ padding: "20px 22px", marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Failed payments</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {analytics.failed_payments.map((f) => (
              <Link
                key={f.id}
                to={`/dashboard/transactions/${f.id}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", textDecoration: "none", color: "inherit" }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{formatMinorAmount(f.amount_minor, f.currency)}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{f.customer_email ?? "—"}</div>
                </div>
                <StatusBadge status="failed" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>
          Recent transactions
        </div>
        {recent.length === 0 ? (
          <p style={{ padding: 20, color: "var(--color-text-muted)" }}>
            No transactions yet. Create a checkout session, payment link, or invoice to see it appear here.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.slice(0, 5).map((t) => (
                <tr key={t.id}>
                  <td className="mono">
                    <Link to={`/dashboard/transactions/${t.id}`} style={{ color: "var(--color-accent)", textDecoration: "none" }}>
                      {t.gateway_reference ?? t.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{formatMinorAmount(t.amount_minor, t.currency)}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td style={{ color: "var(--color-text-muted)" }}>{formatDate(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
