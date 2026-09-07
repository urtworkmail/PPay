import { PRODUCTS, RELEASES } from "../data/releases";
import { CheckIcon } from "./Icons";

/** The right-hand panel on the auth screens: what shipped recently, what the
 *  product does, and a preview of the dashboard you're signing in to.
 *
 *  The preview shows an empty state rather than invented revenue figures. A
 *  fabricated chart on the sign-in screen of a payments product that is openly
 *  in sandbox would be the one dishonest surface in the whole app.
 */
function PreviewStat({ label, value, hint }) {
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
      <div style={{ fontSize: 17, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--color-text-faint)", marginTop: 1 }}>{hint}</div>
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

      {/* Dashboard preview */}
      <div
        className="card"
        style={{ overflow: "hidden", boxShadow: "var(--shadow-md)" }}
      >
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
            app.ppay.silicatelabs.site
          </span>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>Overview</span>
            <span className="badge badge-pending" style={{ fontSize: 10 }}>
              Sandbox
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
            <PreviewStat label="Total volume" value="Rs 0" hint="No live data yet" />
            <PreviewStat label="Success rate" value="—" hint="Awaiting payments" />
            <PreviewStat label="Payouts" value="Rs 0" hint="Next batch" />
          </div>

          {/* Illustrative axis, deliberately without a fabricated trend line. */}
          <div
            style={{
              height: 84,
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "var(--color-text-faint)",
            }}
          >
            Your revenue chart appears here once payments start
          </div>
        </div>
      </div>

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
