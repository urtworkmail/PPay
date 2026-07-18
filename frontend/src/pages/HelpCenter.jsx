import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLinkIcon, SearchIcon } from "../components/Icons";
import { ARTICLES, CATEGORIES, searchArticles } from "../support/articles";

const TEST_CARDS = [
  { value: "4242 4242 4242 4242", result: "Always succeeds" },
  { value: "4000 0000 0000 0002", result: "Declined — insufficient funds" },
  { value: "4000 0000 0000 0069", result: "Declined — expired card" },
  { value: "4000 0000 0000 0119", result: "Declined — processing error" },
];

export default function HelpCenter() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const results = searchArticles(query);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Help Center</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24 }}>
        Search articles, browse by topic, or read the developer documentation.
      </p>

      <div style={{ position: "relative", marginBottom: 28 }}>
        <SearchIcon
          width={16}
          height={16}
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for anything — refunds, dunning, payouts, team roles…"
          style={{ paddingLeft: 38, fontSize: 14.5, padding: "12px 14px 12px 38px" }}
        />
        {query.trim() && (
          <div className="card" style={{ marginTop: 8, maxHeight: 360, overflowY: "auto" }}>
            {results.length === 0 ? (
              <p style={{ padding: 16, color: "var(--color-text-muted)", fontSize: 13.5 }}>No articles match "{query}".</p>
            ) : (
              results.map((a) => (
                <button
                  key={a.slug}
                  onClick={() => navigate(`/dashboard/help/${a.slug}`)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid var(--color-border)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{a.summary}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginBottom: 32 }}>
        {CATEGORIES.map((cat) => {
          const count = ARTICLES.filter((a) => a.category === cat.slug).length;
          return (
            <Link
              key={cat.slug}
              to={`/dashboard/help/category/${cat.slug}`}
              className="card"
              style={{ padding: 18, textDecoration: "none", color: "var(--color-text)", display: "block" }}
            >
              <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>{cat.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginBottom: 8 }}>{cat.description}</div>
              <div style={{ fontSize: 11.5, color: "var(--color-text-faint)" }}>{count} article{count === 1 ? "" : "s"}</div>
            </Link>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "start" }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Building an integration?</div>
          <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", marginBottom: 14 }}>
            The full API reference — authentication, every endpoint, webhook signature verification, error codes —
            lives in the developer documentation, not here.
          </p>
          <Link
            to="/docs"
            target="_blank"
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
          >
            Open developer docs <ExternalLinkIcon width={13} height={13} />
          </Link>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Test cards</div>
          {TEST_CARDS.map((c) => (
            <div key={c.value} style={{ marginBottom: 8 }}>
              <div className="mono" style={{ fontSize: 13 }}>{c.value}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{c.result}</div>
            </div>
          ))}
          <Link to="/docs/testing" target="_blank" style={{ fontSize: 12.5, color: "var(--color-accent)", textDecoration: "none" }}>
            Full list incl. wallets →
          </Link>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginTop: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Still stuck?</div>
        <a href="mailto:support@ppay.dev" style={{ fontSize: 13.5, color: "var(--color-accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          support@ppay.dev <ExternalLinkIcon width={13} height={13} />
        </a>
      </div>
    </div>
  );
}
