import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ARTICLES, CATEGORIES, searchArticles } from "../support/articles";
import { ArrowLeftIcon, ExternalLinkIcon, PinIcon, SearchIcon, XIcon } from "./Icons";

function Block({ block }) {
  if (block.type === "ul") {
    return (
      <ul style={{ fontSize: 13.5, lineHeight: 1.7, paddingLeft: 18, margin: "0 0 12px" }}>
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p style={{ fontSize: 13.5, lineHeight: 1.65, margin: "0 0 12px" }}>{block.text}</p>;
}

function RootView({ onOpenCategory, onNavigateApp }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-faint)", margin: "4px 0 8px" }}>
        Browse by topic
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
        {CATEGORIES.map((cat) => {
          const count = ARTICLES.filter((a) => a.category === cat.slug).length;
          return (
            <button
              key={cat.slug}
              onClick={() => onOpenCategory(cat.slug)}
              className="card"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "12px 14px",
                background: "var(--color-surface)",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{cat.title}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>{cat.description}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-faint)", marginTop: 4 }}>
                {count} article{count === 1 ? "" : "s"}
              </div>
            </button>
          );
        })}
      </div>

      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Building an integration?</div>
        <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginBottom: 10 }}>
          The full API reference lives in the developer documentation.
        </p>
        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 12.5 }}
        >
          Open developer docs <ExternalLinkIcon width={12} height={12} />
        </a>
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
        <a href="mailto:support@ppay.dev" style={{ fontSize: 12.5, color: "var(--color-accent)", textDecoration: "none" }}>
          Still stuck? support@ppay.dev
        </a>
        <button
          onClick={() => onNavigateApp("/dashboard/status")}
          style={{ fontSize: 12, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
        >
          System Status
        </button>
      </div>
    </div>
  );
}

function CategoryView({ slug, onOpenArticle }) {
  const category = CATEGORIES.find((c) => c.slug === slug);
  const articles = ARTICLES.filter((a) => a.category === slug);
  if (!category) return null;

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{category.title}</h2>
      <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 0, marginBottom: 14 }}>{category.description}</p>
      <div className="card">
        {articles.map((a) => (
          <button
            key={a.slug}
            onClick={() => onOpenArticle(a.slug)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "12px 14px",
              background: "none",
              border: "none",
              borderBottom: "1px solid var(--color-border)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.title}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>{a.summary}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ArticleView({ slug, onOpenArticle }) {
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) return null;
  const related = ARTICLES.filter((a) => a.category === article.category && a.slug !== article.slug).slice(0, 4);

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{article.title}</h2>
      <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 0, marginBottom: 16 }}>{article.summary}</p>
      {article.body.map((block, i) => (
        <Block key={i} block={block} />
      ))}

      {related.length > 0 && (
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-faint)", marginBottom: 8 }}>
            Related
          </div>
          {related.map((a) => (
            <button
              key={a.slug}
              onClick={() => onOpenArticle(a.slug)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 0",
                background: "none",
                border: "none",
                fontSize: 12.5,
                color: "var(--color-accent)",
                cursor: "pointer",
              }}
            >
              {a.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HelpPanel({ open, onClose }) {
  // Stack-based nav so Back always returns to exactly where the user came
  // from (root -> category -> article, or straight from a search result).
  const [stack, setStack] = useState([{ type: "root" }]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setStack([{ type: "root" }]);
      setQuery("");
    }
  }, [open]);

  const [pinned, setPinned] = useState(() => localStorage.getItem("ppay_help_pinned") === "1");
  const [width, setWidth] = useState(() => Number(localStorage.getItem("ppay_help_width")) || 400);
  const resizing = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem("ppay_help_pinned", pinned ? "1" : "0");
  }, [pinned]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape" && !pinned) onClose();
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, pinned]);

  useEffect(() => {
    function onMove(e) {
      if (!resizing.current) return;
      const next = Math.min(720, Math.max(320, window.innerWidth - e.clientX));
      setWidth(next);
    }
    function onUp() {
      if (!resizing.current) return;
      resizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem("ppay_help_width", String(width));
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  function startResize(e) {
    e.preventDefault();
    resizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  const current = stack[stack.length - 1];
  const searching = query.trim().length > 0;
  const searchResults = searching ? searchArticles(query) : [];

  function openCategory(slug) {
    setStack((s) => [...s, { type: "category", slug }]);
  }
  function openArticle(slug) {
    setQuery("");
    setStack((s) => [...s, { type: "article", slug }]);
  }
  function goBack() {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }
  function navigateApp(path) {
    if (!pinned) onClose();
    navigate(path);
  }

  return (
    <>
      {!pinned && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            zIndex: 90,
            opacity: open ? 1 : 0,
            pointerEvents: open ? "auto" : "none",
            transition: "opacity 0.18s ease",
          }}
        />
      )}
      <aside
        role="dialog"
        aria-label="Help"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width,
          maxWidth: "90vw",
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: pinned ? "none" : "-8px 0 24px rgba(0,0,0,0.12)",
          zIndex: 91,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: resizing.current ? "none" : "transform 0.2s ease",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div
          onMouseDown={startResize}
          title="Drag to resize"
          style={{
            position: "absolute",
            left: -4,
            top: 0,
            width: 8,
            height: "100%",
            cursor: "col-resize",
            zIndex: 92,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
          {stack.length > 1 && !searching ? (
            <button
              onClick={goBack}
              aria-label="Back"
              style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4 }}
            >
              <ArrowLeftIcon width={16} height={16} />
            </button>
          ) : null}
          <div style={{ fontWeight: 700, fontSize: 15 }}>Help</div>
          <button
            onClick={() => setPinned((v) => !v)}
            aria-label={pinned ? "Unpin help panel" : "Pin help panel open"}
            title={pinned ? "Pinned — click to unpin" : "Pin open so it stays while you work"}
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              background: pinned ? "var(--color-accent-soft)" : "none",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              color: pinned ? "var(--color-accent)" : "var(--color-text-muted)",
              padding: 5,
            }}
          >
            <PinIcon width={15} height={15} />
          </button>
          <button
            onClick={onClose}
            aria-label="Close help"
            style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4 }}
          >
            <XIcon width={16} height={16} />
          </button>
        </div>

        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <SearchIcon width={14} height={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-faint)" }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help articles…"
              style={{ width: "100%", paddingLeft: 32, fontSize: 13.5, background: "var(--color-bg)", border: "1px solid var(--color-border)" }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {searching ? (
            searchResults.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>No articles match "{query}".</p>
            ) : (
              <div className="card">
                {searchResults.map((a) => (
                  <button
                    key={a.slug}
                    onClick={() => openArticle(a.slug)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 14px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid var(--color-border)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>{a.summary}</div>
                  </button>
                ))}
              </div>
            )
          ) : current.type === "root" ? (
            <RootView onOpenCategory={openCategory} onNavigateApp={navigateApp} />
          ) : current.type === "category" ? (
            <CategoryView slug={current.slug} onOpenArticle={openArticle} />
          ) : (
            <ArticleView slug={current.slug} onOpenArticle={openArticle} />
          )}
        </div>
      </aside>
    </>
  );
}
