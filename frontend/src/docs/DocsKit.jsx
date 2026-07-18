export function H2({ id, children }) {
  return (
    <h2 id={id} style={{ fontSize: 20, fontWeight: 700, marginTop: 36, marginBottom: 12, scrollMarginTop: 90 }}>
      {children}
    </h2>
  );
}

export function H3({ id, children }) {
  return (
    <h3 id={id} style={{ fontSize: 15.5, fontWeight: 700, marginTop: 26, marginBottom: 8, scrollMarginTop: 90 }}>
      {children}
    </h3>
  );
}

export function P({ children }) {
  return <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--color-text)", margin: "0 0 14px" }}>{children}</p>;
}

export function Callout({ tone = "info", children }) {
  const colors = {
    info: { bg: "var(--color-accent-soft)", fg: "var(--color-accent)" },
    warn: { bg: "var(--color-pending-soft)", fg: "var(--color-pending)" },
    danger: { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
  }[tone];
  return (
    <div
      style={{
        background: colors.bg,
        color: colors.fg,
        borderRadius: "var(--radius-md)",
        padding: "12px 16px",
        fontSize: 13.5,
        lineHeight: 1.6,
        margin: "16px 0",
      }}
    >
      {children}
    </div>
  );
}

export function DocsTable({ headers, rows }) {
  return (
    <div className="card" style={{ margin: "16px 0", overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={j === 0 ? { fontFamily: "var(--mono, inherit)" } : undefined} className={j === 0 ? "mono" : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Ul({ items }) {
  return (
    <ul style={{ fontSize: 14.5, lineHeight: 1.8, color: "var(--color-text)", paddingLeft: 20, margin: "0 0 14px" }}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
