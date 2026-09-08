import { useEffect, useState } from "react";
import { PRODUCTS, RELEASES } from "../data/releases";
import { CheckIcon } from "./Icons";

/** The right-hand panel on the auth screens: what shipped recently, what the
 *  product does, and a rotating preview of a few different parts of the
 *  dashboard.
 *
 *  The numbers in these previews are illustrative example data — the same
 *  kind of sandbox sample shown throughout the marketing site's own product
 *  pages — not a claim about the viewer's own (nonexistent, pre-signup)
 *  account. Every card keeps its "Sandbox" badge for exactly that reason.
 */
function PreviewStat({ label, value, hint, tone }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-faint)",
          marginBottom: 4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: tone === "success" ? "var(--color-success)" : "var(--color-text)" }}>
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginTop: 1 }}>{hint}</div>
    </div>
  );
}

function PreviewRow({ title, sub, badge, badgeClass = "badge-success" }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "9px 12px",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginTop: 1 }}>{sub}</div>
      </div>
      <span className={`badge ${badgeClass}`} style={{ fontSize: 10, flexShrink: 0, marginLeft: 8 }}>
        {badge}
      </span>
    </div>
  );
}

function ChromeBar({ path }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 14px",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-bg)",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff5f57" }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#febc2e" }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#28c840" }} />
      <span className="mono" style={{ fontSize: 11, color: "var(--color-text-faint)", marginLeft: 6 }}>
        {path}
      </span>
    </div>
  );
}

function CardHeader({ title }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 16, fontWeight: 800 }}>{title}</span>
      <span className="badge badge-pending" style={{ fontSize: 10 }}>
        Sandbox
      </span>
    </div>
  );
}

/** Each preview is a plain functional component so the carousel array below
 *  stays a simple list of things to render, not a data structure trying to
 *  describe five structurally different mockups. */
function OverviewPreview() {
  return (
    <div className="card" style={{ overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
      <ChromeBar path="app.ppay.silicatelabs.site/dashboard" />
      <div style={{ padding: 16 }}>
        <CardHeader title="Overview" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
          <PreviewStat label="Total volume" value="Rs 284,745" hint="70 transactions" />
          <PreviewStat label="Success rate" value="94.2%" tone="success" hint="Last 30 days" />
          <PreviewStat label="Payouts" value="Rs 218,400" hint="Next batch Fri" />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 70, padding: "0 2px" }}>
          {[42, 58, 40, 66, 52, 74, 60, 80, 68, 88, 76, 96].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "3px 3px 0 0", background: "var(--color-accent-soft)", position: "relative" }}>
              <div style={{ position: "absolute", inset: "auto 0 0 0", height: "40%", borderRadius: "3px 3px 0 0", background: "var(--color-accent)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckoutPreview() {
  return (
    <div className="card" style={{ overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
      <ChromeBar path="pay.ppay.silicatelabs.site/c/cs_9fA2" />
      <div style={{ padding: 16 }}>
        <CardHeader title="Checkout" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-faint)" }}>
              Order #1029
            </div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Rs 1,500.00</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginBottom: 10 }}>
          {["Card", "Wallet", "Bank"].map((m, i) => (
            <div
              key={m}
              style={{
                textAlign: "center",
                fontSize: 11,
                padding: "8px 0",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${i === 0 ? "var(--color-accent)" : "var(--color-border)"}`,
                color: i === 0 ? "var(--color-accent)" : "var(--color-text-muted)",
                fontWeight: i === 0 ? 700 : 500,
              }}
            >
              {m}
            </div>
          ))}
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 12.5,
            fontWeight: 700,
            color: "#fff",
            background: "var(--color-accent)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 0",
          }}
        >
          Pay Rs 1,500.00
        </div>
      </div>
    </div>
  );
}

function SentinelPreview() {
  return (
    <div className="card" style={{ overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
      <ChromeBar path="app.ppay.silicatelabs.site/transactions" />
      <div style={{ padding: 16 }}>
        <CardHeader title="Sentinel" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-faint)" }}>
            Risk score
          </div>
          <span className="badge badge-danger" style={{ fontSize: 10 }}>
            Blocked
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 9 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: "var(--color-danger)" }}>82</span>
          <span style={{ fontSize: 10.5, color: "var(--color-text-faint)" }}>/ 100 · threshold 75</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "var(--color-border)", overflow: "hidden", marginBottom: 12 }}>
          <div style={{ width: "82%", height: "100%", background: "var(--color-danger)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {["velocity_email", "first_time_customer", "amount_deviation"].map((flag) => (
            <div key={flag} className="mono" style={{ fontSize: 10.5, color: "var(--color-text-muted)" }}>
              → {flag}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SubscriptionsPreview() {
  return (
    <div className="card" style={{ overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
      <ChromeBar path="app.ppay.silicatelabs.site/subscriptions" />
      <div style={{ padding: 16 }}>
        <CardHeader title="Subscriptions" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 10 }}>
          <PreviewStat label="Active" value="128" hint="+6 this week" />
          <PreviewStat label="MRR" value="Rs 384k" tone="success" hint="Monthly recurring" />
        </div>
        <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <PreviewRow title="Pro plan · monthly" sub="Renews in 3 days" badge="Active" />
          <PreviewRow title="Studio plan · monthly" sub="Retry 2 of 3" badge="Past due" badgeClass="badge-pending" />
        </div>
      </div>
    </div>
  );
}

const PREVIEWS = [
  { key: "overview", Component: OverviewPreview },
  { key: "checkout", Component: CheckoutPreview },
  { key: "sentinel", Component: SentinelPreview },
  { key: "subscriptions", Component: SubscriptionsPreview },
];

const ROTATE_MS = 5000;

function PreviewCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % PREVIEWS.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  const { Component } = PREVIEWS[index];

  return (
    <div>
      <Component />
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
        {PREVIEWS.map((p, i) => (
          <button
            key={p.key}
            onClick={() => setIndex(i)}
            aria-label={`Show ${p.key} preview`}
            style={{
              width: i === index ? 18 : 6,
              height: 6,
              borderRadius: 999,
              border: "none",
              padding: 0,
              cursor: "pointer",
              background: i === index ? "var(--color-accent)" : "var(--color-border)",
              transition: "width 0.2s ease, background 0.2s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AuthShowcase() {
  const latest = RELEASES[0];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        width: "100%",
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      {/* What's new */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "var(--color-accent)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-accent)" }} />
            What's new
          </span>
          <a
            href="/docs"
            style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: "var(--color-text-muted)", textDecoration: "none" }}
          >
            View all changes →
          </a>
        </div>

        <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 6px" }}>
          {latest.version} — {latest.title}
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", margin: "0 0 12px", lineHeight: 1.55 }}>
          {latest.summary}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {latest.highlights.map((highlight) => (
            <span
              key={highlight}
              className="badge"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
            >
              {highlight}
            </span>
          ))}
        </div>
      </div>

      {/* Rotating dashboard preview */}
      <PreviewCarousel />

      {/* What you get */}
      <div>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--color-text-faint)",
            marginBottom: 10,
          }}
        >
          Built and ready to use
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8 }}>
          {PRODUCTS.map((product) => (
            <div key={product.name} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <CheckIcon width={13} height={13} style={{ color: "var(--color-success)", flexShrink: 0, marginTop: 3 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{product.name}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{product.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
