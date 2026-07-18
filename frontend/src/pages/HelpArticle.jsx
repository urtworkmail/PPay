import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "../components/Icons";
import { ARTICLES, CATEGORIES } from "../support/articles";

function Block({ block }) {
  if (block.type === "ul") {
    return (
      <ul style={{ fontSize: 14.5, lineHeight: 1.8, paddingLeft: 20, margin: "0 0 14px" }}>
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p style={{ fontSize: 14.5, lineHeight: 1.7, margin: "0 0 14px" }}>{block.text}</p>;
}

export default function HelpArticle() {
  const { articleSlug } = useParams();
  const article = ARTICLES.find((a) => a.slug === articleSlug);

  if (!article) return <Navigate to="/dashboard/help" replace />;

  const category = CATEGORIES.find((c) => c.slug === article.category);
  const related = ARTICLES.filter((a) => a.category === article.category && a.slug !== article.slug).slice(0, 4);

  return (
    <div>
      <Link
        to={`/dashboard/help/category/${article.category}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-text-muted)", textDecoration: "none", marginBottom: 18 }}
      >
        <ArrowLeftIcon width={14} height={14} /> {category?.title}
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6, maxWidth: 620 }}>{article.title}</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24 }}>{article.summary}</p>
          <div style={{ maxWidth: 620 }}>
            {article.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        </div>

        {related.length > 0 && (
          <div className="card" style={{ padding: 16, alignSelf: "start" }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-faint)", marginBottom: 10 }}>
              More in {category?.title}
            </div>
            {related.map((a) => (
              <Link
                key={a.slug}
                to={`/dashboard/help/${a.slug}`}
                style={{ display: "block", padding: "8px 0", fontSize: 13, color: "var(--color-accent)", textDecoration: "none" }}
              >
                {a.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
