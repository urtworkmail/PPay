export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 400, padding: "36px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--color-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 700,
            }}
          >
            O
          </div>
          <span style={{ fontWeight: 700, fontSize: 17 }}>PPay</span>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>{title}</h1>
        {subtitle && (
          <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", margin: "0 0 24px" }}>{subtitle}</p>
        )}
        {children}
      </div>
    </div>
  );
}
