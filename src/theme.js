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

// The alternate type pairings load on demand — index.html ships only the
// default Baloo 2 + Inter pairing.
const FONT_URLS = {
  barlow: "https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@600;700&display=swap",
  grotesk: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;600&display=swap",
};
const fontsLoaded = new Set();
export function ensureFonts(fontKey) {
  const url = FONT_URLS[fontKey];
  if (!url || fontsLoaded.has(fontKey)) return;
  fontsLoaded.add(fontKey);
  if (document.querySelector(`link[href="${url}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

// Tennis-lime first (the default brand accent — black text reads on it), then
// royal court blue, sky, and a warm option.
export const TP_ACCENTS = ["#C4F22E", "#3D49E3", "#2EAEFF", "#FF6B00"];

// Fixed brand colors (independent of the user's accent choice).
export const TP_BRAND = { blue: "#3D49E3", lime: "#C4F22E", navy: "#0A0F26" };

// ---- contrast helpers ----
// The accent is user-selectable, so nothing painted on it (or with it) can
// assume lime: ink and text colors are computed from the actual accent.
function chan(hex, i) {
  const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function lum(hex) { return 0.2126 * chan(hex, 0) + 0.7152 * chan(hex, 1) + 0.0722 * chan(hex, 2); }
function contrast(a, b) {
  const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
  return (hi + 0.05) / (lo + 0.05);
}
function mixWhite(hex, t) {
  const c = (i) => Math.round(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * (1 - t) + 255 * t);
  return "#" + [0, 1, 2].map((i) => c(i).toString(16).padStart(2, "0")).join("");
}
// Ink color for text/icons sitting ON the accent (buttons, FAB, podium…).
function accentInk(accent) { return contrast(accent, "#0a0a0a") >= contrast(accent, "#ffffff") ? "#0a0a0a" : "#ffffff"; }
// Accent used AS text on the background: lighten until it reads (dark mode's
// royal blue was near-invisible on navy).
function accentOnBg(accent, bg) {
  let c = accent;
  for (let i = 0; i < 8 && contrast(c, bg) < 4.5; i++) c = mixWhite(c, 0.14);
  return c;
}

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
    "--accent-ink": accentInk(t.accent),
    "--accent-text": dark ? accentOnBg(t.accent, "#0A0F26") : TP_BRAND.blue,
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
    "--warning": "#E6A23C",
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
