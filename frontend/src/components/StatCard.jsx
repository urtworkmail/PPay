export default function StatCard({ label, value, sublabel }) {
  return (
    <div className="card" style={{ padding: "20px 22px", flex: "1 1 200px" }}>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em" }}>{value}</div>
      {sublabel && (
        <div style={{ fontSize: 13, color: "var(--color-text-faint)", marginTop: 6 }}>{sublabel}</div>
      )}
    </div>
  );
}
