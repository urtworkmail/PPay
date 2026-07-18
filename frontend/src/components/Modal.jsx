export default function Modal({ title, children, onClose }) {
  return (
    <div
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
      {/* Deliberately no onClick={onClose} on the overlay — a stray click outside
          shouldn't discard whatever the user has typed. Only an explicit action
          inside (Cancel/Confirm) should dismiss this. */}
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: 24, background: "var(--color-surface)" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
