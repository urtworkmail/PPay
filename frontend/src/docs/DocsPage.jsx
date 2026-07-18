import { Navigate, useParams } from "react-router-dom";
import { DOCS_FLAT } from "./pages";

export default function DocsPage() {
  const { slug } = useParams();
  const entry = DOCS_FLAT.find((p) => p.slug === slug);

  if (!entry) {
    return <Navigate to="/docs/getting-started" replace />;
  }

  const { Component } = entry;
  return <Component />;
}
