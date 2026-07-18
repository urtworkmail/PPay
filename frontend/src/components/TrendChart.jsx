import { useState } from "react";

const WIDTH = 100;
const HEIGHT = 100;
const TOP_PAD = 12;
const BOTTOM_PAD = 4;

export default function TrendChart({ points, formatValue, formatDate, color = "var(--color-accent)", height = 140 }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const max = Math.max(...points.map((p) => p.value), 1);
  const usableHeight = HEIGHT - TOP_PAD - BOTTOM_PAD;

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? WIDTH / 2 : (i / (points.length - 1)) * WIDTH;
    const y = TOP_PAD + usableHeight - (p.value / max) * usableHeight;
    return { x, y, ...p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${HEIGHT} L${coords[0].x},${HEIGHT} Z`;
  const gradientId = `trend-gradient-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  const hovered = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div style={{ position: "relative", height }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        {hovered && (
          <line x1={hovered.x} y1={TOP_PAD} x2={hovered.x} y2={HEIGHT} stroke="var(--color-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={hoverIndex === i ? 2.4 : 0}
            fill={color}
            vectorEffect="non-scaling-stroke"
            style={{ transition: "r 0.1s ease" }}
          />
        ))}
        {coords.map((c, i) => (
          <rect
            key={`hit-${i}`}
            x={points.length === 1 ? 0 : (i - 0.5) * (WIDTH / points.length)}
            y="0"
            width={WIDTH / points.length}
            height={HEIGHT}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
          />
        ))}
      </svg>
      {hovered && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${hovered.x}%`,
            transform: hovered.x > 75 ? "translateX(-100%)" : hovered.x < 25 ? "translateX(0)" : "translateX(-50%)",
            background: "var(--color-text)",
            color: "var(--color-bg)",
            fontSize: 11.5,
            fontWeight: 600,
            padding: "5px 8px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {formatValue(hovered.value)}
          <div style={{ fontWeight: 400, opacity: 0.75 }}>{formatDate(hovered.date)}</div>
        </div>
      )}
    </div>
  );
}
