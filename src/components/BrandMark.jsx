import React from "react";
import logoUrl from "../assets/ternak-logo.png";

// Ternak Padel brand marks.
// BrandLogo  → the real logo artwork (perspective court cage, arched "Ternak",
//              "padel" spelled with photographic tennis balls).
// CourtBadge → a tiny app-icon abstraction of the same mark (cage + ball) for
//              sizes where the full artwork can't read.

const BLUE = "#3D49E3";
const LIME = "#C4F22E";

// The official logo, exported from the source artwork (transparent PNG).
export const TERNAK_LOGO_SRC = logoUrl;

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

// Full logo for the hero / loading / splash — the real artwork.
// Native aspect ratio of the source export is ~1319 × 768 (≈ 0.582).
export function BrandLogo({ width = 300, dark = true }) {
  return (
    <img
      src={logoUrl}
      width={width}
      alt="Ternak Padel"
      style={{
        display: "block",
        width,
        height: "auto",
        // a soft glow lifts the artwork off the dark hero without a hard card edge
        filter: dark
          ? "drop-shadow(0 12px 40px rgba(61,73,227,0.35))"
          : "drop-shadow(0 10px 30px rgba(10,15,38,0.18))",
      }}
    />
  );
}
