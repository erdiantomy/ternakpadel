// Theme + type pairings. All components read CSS custom properties set on the app shell.
// Palette + tone are lifted straight from the Ternak Padel logo: royal-blue court
// cage, tennis-lime balls, deep-navy ground, bold rounded athletic lettering, on a
// clean near-white court in light mode.

export const TP_FONTS = {
  // The brand pairing — rounded heavy display (echoes the "Ternak" wordmark) + clean body.
  brand: { label: "Ternak (brand)", display: "'Baloo 2', 'Inter', sans-serif", body: "'Inter', sans-serif", dWeight: 800, dSpacing: "0", dTransform: "none" },
  inter: { label: "Inter (spec)", display: "'Inter', sans-serif", body: "'Inter', sans-serif", dWeight: 800, dSpacing: "-0.02em", dTransform: "none" },
  barlow: { label: "Barlow Cond. (athletic)", display: "'Barlow Condensed', sans-serif", body: "'Barlow', sans-serif", dWeight: 700, dSpacing: "0.01em", dTransform: "uppercase" },
  grotesk: { label: "Space Grotesk (technical)", display: "'Space Grotesk', sans-serif", body: "'IBM Plex Sans', sans-serif", dWeight: 700, dSpacing: "-0.01em", dTransform: "none" },
};

// Tennis-lime first (the default brand accent — black text reads on it), then
// royal court blue, sky, and a warm option.
export const TP_ACCENTS = ["#C4F22E", "#3D49E3", "#2EAEFF", "#FF6B00"];

// Fixed brand colors (independent of the user's accent choice).
export const TP_BRAND = { blue: "#3D49E3", lime: "#C4F22E", navy: "#0A0F26" };

// The court-cage texture that sits behind the app field — a faint royal-blue net
// grid lit by a stadium glow from above. Built as a layered CSS background so it
// rides along anywhere `var(--bg)` is painted, touching no layout.
function courtField(dark) {
  const line = dark ? "rgba(99,116,255,0.06)" : "rgba(61,73,227,0.07)";
  const glow = dark ? "rgba(61,73,227,0.20)" : "rgba(61,73,227,0.10)";
  const base = dark ? "#0A0F26" : "#F2F5FC";
  const cell = 40; // net cell size
  return [
    `radial-gradient(125% 80% at 50% -12%, ${glow}, transparent 58%)`,
    `repeating-linear-gradient(90deg, transparent 0 ${cell - 1}px, ${line} ${cell - 1}px ${cell}px)`,
    `repeating-linear-gradient(0deg, transparent 0 ${cell - 1}px, ${line} ${cell - 1}px ${cell}px)`,
    base,
  ].join(", ");
}

export function tpTheme(t) {
  const dark = t.theme === "dark";
  const f = TP_FONTS[t.font] || TP_FONTS.brand;
  const sp = t.density === "compact" ? 0.82 : 1;
  return {
    "--accent": t.accent,
    "--accent-soft": t.accent + (dark ? "2e" : "22"),
    "--accent-text": dark ? t.accent : TP_BRAND.blue,
    "--brand": TP_BRAND.blue,
    "--brand-soft": dark ? "rgba(61,73,227,0.18)" : "rgba(61,73,227,0.12)",
    "--lime": TP_BRAND.lime,
    "--bg": courtField(dark),
    "--bg-solid": dark ? "#0A0F26" : "#F2F5FC",
    "--surface": dark ? "#141C3D" : "#ffffff",
    "--surface2": dark ? "#1E2A55" : "#E8EDFA",
    "--text": dark ? "#F2F5FF" : "#111A38",
    "--text2": dark ? "#94A0C8" : "#5C6892",
    "--line": dark ? "#2A3766" : "#D9E1F4",
    // royal-blue "cage" hairline used for framing motifs
    "--cage": dark ? "rgba(99,116,255,0.34)" : "rgba(61,73,227,0.30)",
    "--success": "#34D27B",
    "--danger": "#FF5470",
    // rounded, friendly geometry + brand-tinted depth
    "--radius": "18px",
    "--radius-sm": "12px",
    "--shadow": dark ? "0 10px 30px rgba(5,8,22,0.55)" : "0 10px 30px rgba(61,73,227,0.12)",
    "--shadow-brand": dark ? "0 14px 38px rgba(61,73,227,0.30)" : "0 14px 38px rgba(61,73,227,0.20)",
    "--ring": t.accent,
    "--font-display": f.display,
    "--font-body": f.body,
    "--dw": f.dWeight,
    "--dsp": f.dSpacing,
    "--dtr": f.dTransform,
    "--sp": sp,
  };
}
