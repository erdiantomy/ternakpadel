// Theme + type pairings. All components read CSS custom properties set on the app shell.
// Palette follows the Ternak Padel logo: royal-blue court, tennis-lime balls,
// deep navy ground, on a near-white in light mode.

export const TP_FONTS = {
  inter: { label: "Inter (spec)", display: "'Inter', sans-serif", body: "'Inter', sans-serif", dWeight: 800, dSpacing: "-0.02em", dTransform: "none" },
  barlow: { label: "Barlow Cond. (athletic)", display: "'Barlow Condensed', sans-serif", body: "'Barlow', sans-serif", dWeight: 700, dSpacing: "0.01em", dTransform: "uppercase" },
  grotesk: { label: "Space Grotesk (technical)", display: "'Space Grotesk', sans-serif", body: "'IBM Plex Sans', sans-serif", dWeight: 700, dSpacing: "-0.01em", dTransform: "none" },
};

// Tennis-lime first (the default brand accent — black text reads on it), then
// royal court blue, sky, and a warm option.
export const TP_ACCENTS = ["#C4F22E", "#3D49E3", "#2EAEFF", "#FF6B00"];

// Fixed brand colors (independent of the user's accent choice).
export const TP_BRAND = { blue: "#3D49E3", lime: "#C4F22E", navy: "#0A0F26" };

export function tpTheme(t) {
  const dark = t.theme === "dark";
  const f = TP_FONTS[t.font] || TP_FONTS.inter;
  const sp = t.density === "compact" ? 0.82 : 1;
  return {
    "--accent": t.accent,
    "--accent-soft": t.accent + (dark ? "2e" : "22"),
    "--accent-text": dark ? t.accent : TP_BRAND.blue,
    "--brand": TP_BRAND.blue,
    "--lime": TP_BRAND.lime,
    "--bg": dark ? "#0A0F26" : "#F2F5FC",
    "--surface": dark ? "#141C3D" : "#ffffff",
    "--surface2": dark ? "#1E2A55" : "#E8EDFA",
    "--text": dark ? "#F2F5FF" : "#111A38",
    "--text2": dark ? "#94A0C8" : "#5C6892",
    "--line": dark ? "#2A3766" : "#D9E1F4",
    "--success": "#34D27B",
    "--danger": "#FF5470",
    "--font-display": f.display,
    "--font-body": f.body,
    "--dw": f.dWeight,
    "--dsp": f.dSpacing,
    "--dtr": f.dTransform,
    "--sp": sp,
  };
}
