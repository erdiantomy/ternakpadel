import React from "react";

// Ternak Padel brand marks, rebuilt as crisp SVG from the logo:
// royal-blue padel-court cage, tennis-lime balls, arched "Ternak", "padel"
// with a ball standing in for a letter.

const BLUE = "#3D49E3";
const LIME = "#C4F22E";

// A tennis ball: lime disc with a white seam.
function Ball({ cx, cy, r }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={LIME} stroke="#A6CE1F" strokeWidth={r * 0.08} />
      <path d={`M ${cx - r * 0.78} ${cy - r * 0.5} Q ${cx} ${cy + r * 0.35} ${cx + r * 0.78} ${cy - r * 0.5}`}
            fill="none" stroke="#ffffff" strokeWidth={r * 0.14} strokeLinecap="round" />
      <path d={`M ${cx - r * 0.78} ${cy + r * 0.5} Q ${cx} ${cy - r * 0.35} ${cx + r * 0.78} ${cy + r * 0.5}`}
            fill="none" stroke="#ffffff" strokeWidth={r * 0.14} strokeLinecap="round" />
    </g>
  );
}

// Court cage outline — the framing motif from the logo.
function Court({ x, y, w, h, sw = 6, color = BLUE, opacity = 1 }) {
  const midX = x + w / 2, midY = y + h / 2;
  return (
    <g stroke={color} strokeWidth={sw} fill="none" opacity={opacity} strokeLinejoin="round">
      <rect x={x} y={y} width={w} height={h} rx={Math.min(w, h) * 0.1} />
      <line x1={midX} y1={y} x2={midX} y2={y + h} strokeWidth={sw * 0.6} />
      <line x1={x} y1={midY} x2={x + w} y2={midY} strokeWidth={sw * 0.45} opacity={0.7} />
      <line x1={x + w * 0.22} y1={y} x2={x + w * 0.22} y2={y + h} strokeWidth={sw * 0.4} opacity={0.5} />
      <line x1={x + w * 0.78} y1={y} x2={x + w * 0.78} y2={y + h} strokeWidth={sw * 0.4} opacity={0.5} />
    </g>
  );
}

// Small app-icon tile: a court with a ball, on a light court field.
export function CourtBadge({ size = 46, radius }) {
  const r = radius ?? size * 0.28;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block" }}>
      <rect x="0" y="0" width="48" height="48" rx={r} fill="#F2F5FC" />
      <Court x={7} y={9} w={34} h={30} sw={3} />
      <Ball cx={24} cy={24} r={6} />
    </svg>
  );
}

// Full stacked wordmark for the hero / loading / splash.
export function BrandLogo({ width = 300, dark = true }) {
  const ink = dark ? "#F4F6FF" : "#0A0F26";
  const navy = dark ? "#C9D2F2" : "#16213F";
  return (
    <svg width={width} viewBox="0 0 360 232" style={{ display: "block" }} role="img" aria-label="Ternak Padel">
      <defs>
        <path id="tp-arc" d="M 64 132 Q 180 64 296 132" />
      </defs>
      {/* court cage */}
      <Court x={18} y={20} w={324} h={192} sw={7} />
      {/* arched Ternak */}
      <text fill={ink} fontFamily="'Barlow Condensed','Space Grotesk',sans-serif"
            fontWeight="700" fontSize="62" letterSpacing="1"
            style={{ textTransform: "uppercase" }}>
        <textPath href="#tp-arc" xlinkHref="#tp-arc" startOffset="50%" textAnchor="middle">Ternak</textPath>
      </text>
      {/* padel with a tennis-ball letter */}
      <g fontFamily="'Barlow Condensed','Space Grotesk',sans-serif" fontWeight="700" fontSize="58" fill={navy}>
        <text x="120" y="186" textAnchor="end" style={{ textTransform: "lowercase" }}>p</text>
        <Ball cx={142} cy={168} r={17} />
        <text x="160" y="186" textAnchor="start" style={{ textTransform: "lowercase" }}>del</text>
      </g>
    </svg>
  );
}
