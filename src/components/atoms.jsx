import React from "react";

// ---------- shared UI atoms (all read CSS custom properties set on the app shell) ----------

export function Disp({ size = 20, children, style, color }) {
  return (
    <div style={{
      fontFamily: "var(--font-display)", fontWeight: "var(--dw)",
      letterSpacing: "var(--dsp)", textTransform: "var(--dtr)",
      fontSize: size, color: color || "var(--text)", lineHeight: 1.1, ...style,
    }}>{children}</div>
  );
}

export function Body({ size = 14, dim, bold, children, style, color }) {
  return (
    <div style={{
      fontFamily: "var(--font-body)", fontSize: size,
      fontWeight: bold ? 600 : 400,
      color: color || (dim ? "var(--text2)" : "var(--text)"),
      lineHeight: 1.35, ...style,
    }}>{children}</div>
  );
}

export function Num({ size = 22, children, style, color }) {
  return (
    <div style={{
      fontFamily: "var(--font-display)", fontWeight: 700, fontVariantNumeric: "tabular-nums",
      fontSize: size, color: color || "var(--text)", lineHeight: 1, letterSpacing: "-0.01em", ...style,
    }}>{children}</div>
  );
}

export function Card({ children, style, onClick, accent, pad }) {
  return (
    <div onClick={onClick} style={{
      background: accent ? "var(--accent-soft)" : "var(--surface)",
      border: "1px solid " + (accent ? "transparent" : "var(--line)"),
      borderRadius: 16, padding: pad != null ? pad : "calc(14px * var(--sp))",
      cursor: onClick ? "pointer" : "default",
      transition: "transform .12s ease, background .15s",
      ...style,
    }}>{children}</div>
  );
}

export function Ava({ ini, d = 36, ring }) {
  return (
    <div style={{
      width: d, height: d, flex: "0 0 " + d + "px", borderRadius: "50%",
      background: "var(--surface2)", color: "var(--text)",
      border: ring ? "2px solid var(--accent)" : "1px solid var(--line)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-body)", fontWeight: 700, fontSize: d * 0.34,
    }}>{ini}</div>
  );
}

export function Pill({ children, on, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      border: "1px solid " + (on ? "var(--accent)" : "var(--line)"),
      background: on ? "var(--accent-soft)" : "transparent",
      color: on ? "var(--text)" : "var(--text2)",
      borderRadius: 999, padding: small ? "4px 10px" : "6px 13px",
      fontFamily: "var(--font-body)", fontSize: small ? 11.5 : 13, fontWeight: 600,
      cursor: onClick ? "pointer" : "default", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

export function Btn({ children, primary, ghost, onClick, full, danger, small, style }) {
  return (
    <button onClick={onClick} style={{
      width: full ? "100%" : undefined,
      background: primary ? "var(--accent)" : danger ? "var(--danger)" : ghost ? "transparent" : "var(--surface2)",
      color: primary || danger ? "#0a0a0a" : "var(--text)",
      border: ghost ? "1px solid var(--line)" : "none",
      borderRadius: 13, padding: small ? "8px 14px" : "13px 18px",
      fontFamily: "var(--font-body)", fontWeight: 700, fontSize: small ? 13 : 15,
      cursor: "pointer", whiteSpace: "nowrap",
      transition: "filter .12s, transform .08s",
      ...style,
    }}
    onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
    onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >{children}</button>
  );
}

export function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 11, padding: 3, gap: 2 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} style={{
          flex: 1, border: "none", borderRadius: 9, padding: "7px 4px",
          background: value === o ? "var(--surface)" : "transparent",
          color: value === o ? "var(--text)" : "var(--text2)",
          fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          boxShadow: value === o ? "0 1px 4px rgba(0,0,0,0.25)" : "none",
        }}>{o}</button>
      ))}
    </div>
  );
}

export function Row({ children, gap = 10, style, onClick }) {
  return <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap, cursor: onClick ? "pointer" : undefined, ...style }}>{children}</div>;
}

export function Col({ children, gap = 10, style }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "calc(" + gap + "px * var(--sp))", ...style }}>{children}</div>;
}

export function SecHead({ children, right, onRight }) {
  return (
    <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
      <Disp size={15}>{children}</Disp>
      {right && (
        <Body size={12.5} bold color="var(--accent-text)" style={{ cursor: onRight ? "pointer" : "default" }}>
          <span onClick={onRight} style={{ cursor: onRight ? "pointer" : "default" }}>{right}</span>
        </Body>
      )}
    </Row>
  );
}

// Sparkline for rank history (lower = better, so callers pass inverted values)
export function Spark({ vals, w = 120, h = 36, stroke = 2, style }) {
  const min = Math.min(...vals), max = Math.max(...vals);
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * (w - 6) + 3;
    const y = ((v - min) / (max - min || 1)) * (h - 10) + 5;
    return x + "," + y;
  });
  return (
    <svg width={w} height={h} style={{ display: "block", ...style }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="3.5" fill="var(--accent)" />
    </svg>
  );
}

export function Bars({ vals, h = 44, hi = -1 }) {
  const max = Math.max(...vals);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: h }}>
      {vals.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: Math.max(8, (v / max) * 100) + "%", borderRadius: 5,
          background: i === hi ? "var(--accent)" : "var(--surface2)",
        }} />
      ))}
    </div>
  );
}

// Bottom sheet modal
export function Sheet({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 60,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
      animation: "tpFade .18s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--bg)", borderRadius: "22px 22px 0 0",
        padding: "10px 18px calc(26px + env(safe-area-inset-bottom))",
        animation: "tpUp .25s cubic-bezier(.2,.9,.3,1)",
        maxHeight: "85%", overflowY: "auto",
      }}>
        <div style={{ width: 38, height: 4.5, borderRadius: 3, background: "var(--line)", margin: "0 auto 12px" }} />
        {title && <Disp size={19} style={{ marginBottom: 12 }}>{title}</Disp>}
        {children}
      </div>
    </div>
  );
}

export function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "absolute", top: "calc(14px + env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)",
      zIndex: 80, background: "var(--surface)", border: "1px solid var(--line)",
      color: "var(--text)", borderRadius: 999, padding: "9px 18px",
      fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
      boxShadow: "0 8px 30px rgba(0,0,0,0.45)", whiteSpace: "nowrap",
      animation: "tpUp .25s ease",
    }}>{msg}</div>
  );
}

// Bottom navigation + FAB
export function TabBar({ tab, setTab, onFab }) {
  const items = [
    ["home", "Home", "M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1v-8.5Z"],
    ["events", "Events", "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm0 5h14M9 3v4m6-4v4"],
    ["matches", "Matches", "M7 4v16M17 4v16M3 9h4m10 0h4M3 15h4m10 0h4"],
    ["rankings", "Ranks", "M5 20V10m7 10V4m7 16v-7"],
    ["profile", "Profile", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"],
  ];
  return (
    <div style={{
      position: "relative", borderTop: "1px solid var(--line)", background: "var(--bg)",
      display: "flex", justifyContent: "space-around",
      padding: "8px 4px calc(6px + env(safe-area-inset-bottom))",
    }}>
      {items.map(([id, label, d]) => (
        <button key={id} onClick={() => setTab(id)} style={{
          background: "none", border: "none", cursor: "pointer", padding: "2px 8px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          color: tab === id ? "var(--accent-text)" : "var(--text2)",
        }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d={d} />
          </svg>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 600 }}>{label}</span>
        </button>
      ))}
      <button onClick={onFab} title="Create match" style={{
        position: "absolute", right: 14, top: -26, width: 52, height: 52, borderRadius: "50%",
        background: "var(--accent)", border: "none", cursor: "pointer",
        boxShadow: "0 6px 20px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
