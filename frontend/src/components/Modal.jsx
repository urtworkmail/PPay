export default function Modal({ title, children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 17, 23, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "100%", maxWidth: 420, padding: 24, background: "var(--color-surface)" }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
