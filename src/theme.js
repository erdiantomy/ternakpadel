// Theme + type pairings. All components read CSS custom properties set on the app shell.

export const TP_FONTS = {
  inter: { label: "Inter (spec)", display: "'Inter', sans-serif", body: "'Inter', sans-serif", dWeight: 800, dSpacing: "-0.02em", dTransform: "none" },
  barlow: { label: "Barlow Cond. (athletic)", display: "'Barlow Condensed', sans-serif", body: "'Barlow', sans-serif", dWeight: 700, dSpacing: "0.01em", dTransform: "uppercase" },
  grotesk: { label: "Space Grotesk (technical)", display: "'Space Grotesk', sans-serif", body: "'IBM Plex Sans', sans-serif", dWeight: 700, dSpacing: "-0.01em", dTransform: "none" },
};

export const TP_ACCENTS = ["#FF6B00", "#C4F22E", "#2EAEFF", "#FF3D71"];

export function tpTheme(t) {
  const dark = t.theme === "dark";
  const f = TP_FONTS[t.font] || TP_FONTS.inter;
  const sp = t.density === "compact" ? 0.82 : 1;
  return {
    "--accent": t.accent,
    "--accent-soft": t.accent + (dark ? "2e" : "24"),
    "--accent-text": t.accent,
    "--bg": dark ? "#050505" : "#f6f5f3",
    "--surface": dark ? "#111111" : "#ffffff",
    "--surface2": dark ? "#1a1a1a" : "#efedea",
    "--text": dark ? "#ffffff" : "#15130f",
    "--text2": dark ? "#a3a3a3" : "#6f6a62",
    "--line": dark ? "#232323" : "#e4e1db",
    "--success": "#00D26A",
    "--danger": "#FF4D4D",
    "--font-display": f.display,
    "--font-body": f.body,
    "--dw": f.dWeight,
    "--dsp": f.dSpacing,
    "--dtr": f.dTransform,
    "--sp": sp,
  };
}
