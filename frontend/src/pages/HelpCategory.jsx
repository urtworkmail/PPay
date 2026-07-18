import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "../components/Icons";
import { ARTICLES, CATEGORIES } from "../support/articles";

export default function HelpCategory() {
  const { categorySlug } = useParams();
  const category = CATEGORIES.find((c) => c.slug === categorySlug);
  const articles = ARTICLES.filter((a) => a.category === categorySlug);

  if (!category) return null;

  return (
    <div>
      <Link
        to="/dashboard/help"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-text-muted)", textDecoration: "none", marginBottom: 18 }}
      >
        <ArrowLeftIcon width={14} height={14} /> Back to Help Center
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{category.title}</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 24 }}>{category.description}</p>

      <div className="card">
        {articles.map((a) => (
          <Link
            key={a.slug}
            to={`/dashboard/help/${a.slug}`}
            style={{
              display: "block",
              padding: "16px 20px",
              borderBottom: "1px solid var(--color-border)",
              textDecoration: "none",
              color: "var(--color-text)",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 2 }}>{a.summary}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
