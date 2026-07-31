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
    <div onClick={onClick}
      role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } } : undefined}
      className={onClick ? "tp-press" : undefined}
      style={{
      background: accent ? "var(--accent-soft)" : "var(--surface)",
      border: "1px solid " + (accent ? "var(--accent)" : "var(--line)"),
      borderRadius: "var(--radius)", padding: pad != null ? pad : "calc(14px * var(--sp))",
      boxShadow: accent ? "none" : "var(--shadow)",
      cursor: onClick ? "pointer" : "default",
      transition: "transform .12s ease, background .15s, border-color .15s, box-shadow .15s",
      ...style,
    }}>{children}</div>
  );
}

export function Ava({ ini, d = 36, ring }) {
  return (
    <div style={{
      width: d, height: d, flex: "0 0 " + d + "px", borderRadius: "50%",
      background: ring ? "var(--accent-soft)" : "var(--surface2)", color: "var(--text)",
      border: ring ? "2px solid var(--accent)" : "1px solid var(--line)",
      boxShadow: ring ? "0 0 0 4px var(--accent-soft)" : "none",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-display)", fontWeight: 700, fontSize: d * 0.36,
    }}>{ini}</div>
  );
}

export function Pill({ children, on, onClick, small }) {
  return (
    <button onClick={onClick} className={onClick ? "tp-press" : undefined} aria-pressed={on != null ? !!on : undefined}
      tabIndex={onClick ? undefined : -1} style={{
      border: "1px solid " + (on ? "var(--accent)" : "var(--line)"),
      background: on ? "var(--accent-soft)" : "transparent",
      color: on ? "var(--text)" : "var(--text2)",
      borderRadius: 999, padding: small ? "4px 10px" : "6px 13px",
      fontFamily: "var(--font-body)", fontSize: small ? 11.5 : 13, fontWeight: 600,
      cursor: onClick ? "pointer" : "default", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

export function Btn({ children, primary, ghost, onClick, full, danger, small, style, disabled, ariaLabel }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={ariaLabel} className="tp-press" style={{
      width: full ? "100%" : undefined,
      background: primary ? "var(--accent)" : danger ? "var(--danger)" : ghost ? "transparent" : "var(--surface2)",
      color: primary ? "var(--accent-ink)" : danger ? "#fff" : "var(--text)",
      // ghost reads as a royal-blue "cage" outline, the logo's framing motif
      border: ghost ? "1.5px solid var(--cage)" : "none",
      borderRadius: small ? "var(--radius-sm)" : "var(--radius)",
      padding: small ? "8px 14px" : "13px 18px",
      fontFamily: "var(--font-display)", fontWeight: 700, fontSize: small ? 13 : 15,
      letterSpacing: "0.005em",
      boxShadow: primary && !disabled ? "0 8px 22px var(--accent-soft), 0 2px 8px var(--accent-soft)" : "none",
      cursor: disabled ? "default" : "pointer", whiteSpace: "nowrap",
      opacity: disabled ? 0.45 : 1,
      transition: "filter .12s, transform .08s, box-shadow .15s, opacity .15s",
      ...style,
    }}>{children}</button>
  );
}

// Shared text field (input or textarea via `multiline`) — one style everywhere
export function Input({ multiline, style, ...props }) {
  const s = {
    background: "var(--surface)", border: "1.5px solid var(--line)",
    borderRadius: "var(--radius-sm)", padding: "12px 14px",
    color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 14,
    width: "100%", boxSizing: "border-box", colorScheme: "dark light",
    ...style,
  };
  return multiline ? <textarea {...props} style={s} /> : <input {...props} style={s} />;
}

// Uppercase micro-label used above values / sections
export function MicroLabel({ children, size = 11, style }) {
  return <Body size={size} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.06em", ...style }}>{children}</Body>;
}

// Pulsing status dot (live indicators)
export function LiveDot({ color = "var(--danger)", size = 8, pulse = true }) {
  return <span aria-hidden style={{
    width: size, height: size, borderRadius: "50%", background: color, flex: "0 0 auto",
    animation: pulse ? "tpPulse 1.2s infinite" : "none",
  }} />;
}

// Small pill button used in overlay headers (Back / Share / Close / Done)
export function HeaderPill({ children, onClick, ariaLabel, style }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel} className="tp-press" style={{
      background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text)",
      borderRadius: 999, padding: "8px 14px", minHeight: 36,
      fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer",
      ...style,
    }}>{children}</button>
  );
}

// Label-over-value stat card (Home form row, Profile career stats)
export function StatTile({ label, value, size = 19, center }) {
  return (
    <Card pad={"calc(11px * var(--sp))"} style={{ flex: 1, textAlign: center ? "center" : "left" }}>
      <MicroLabel size={10.5}>{label}</MicroLabel>
      <Num size={size} style={{ marginTop: 4 }}>{value}</Num>
    </Card>
  );
}

// One row of a leaderboard/standings list — shared by Matches standings,
// Rankings, the host console and the public board.
export function LeaderboardRow({ rank, ini, name, sub, pts, hi, ring, bold, topAccent = true, extra }) {
  return (
    <Row gap={10} style={{
      padding: "8px 8px", borderRadius: "var(--radius-sm)",
      background: hi ? "var(--accent-soft)" : "transparent",
    }}>
      <Num size={14} style={{ width: 20, flex: "0 0 auto" }} color={topAccent && rank <= 3 ? "var(--accent-text)" : "var(--text2)"}>{rank}</Num>
      <Ava ini={ini} d={26} ring={ring} />
      <Body size={13.5} bold={bold != null ? bold : hi} style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</Body>
      {sub && <Body size={11.5} dim style={{ whiteSpace: "nowrap", flex: "0 0 auto" }}>{sub}</Body>}
      {extra}
      <Num size={14} style={{ minWidth: 26, textAlign: "right", flex: "0 0 auto" }}>{pts}</Num>
    </Row>
  );
}

// −/value/+ stepper with courtside-sized tap targets
export function Stepper({ value, onDec, onInc, grow, disabled }) {
  const bs = { minWidth: 44, minHeight: 44, padding: "8px 10px" };
  return (
    <Row gap={6} style={grow ? { flex: 1 } : undefined}>
      <Btn small ghost disabled={disabled} onClick={onDec} ariaLabel="Decrease" style={bs}>−</Btn>
      <Num size={20} style={{ minWidth: 28, textAlign: "center", flex: grow ? 1 : undefined }}>{value}</Num>
      <Btn small primary disabled={disabled} onClick={onInc} ariaLabel="Increase" style={bs}>+</Btn>
    </Row>
  );
}

export function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 13, padding: 3, gap: 2 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className="tp-press" aria-pressed={value === o} style={{
          flex: 1, border: "none", borderRadius: 11, padding: "7px 4px",
          background: value === o ? "var(--accent)" : "transparent",
          color: value === o ? "var(--accent-ink)" : "var(--text2)",
          fontFamily: "var(--font-display)", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
          textTransform: "capitalize",
          boxShadow: value === o ? "0 2px 8px var(--accent-soft)" : "none",
          transition: "background .15s, color .15s",
        }}>{o}</button>
      ))}
    </div>
  );
}

export function Row({ children, gap = 10, style, onClick, ariaLabel }) {
  return <div onClick={onClick}
    role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} aria-label={ariaLabel}
    onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); } } : undefined}
    style={{ display: "flex", alignItems: "center", gap, cursor: onClick ? "pointer" : undefined, ...style }}>{children}</div>;
}

export function Col({ children, gap = 10, style }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "calc(" + gap + "px * var(--sp))", ...style }}>{children}</div>;
}

export function SecHead({ children, right, onRight }) {
  return (
    <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
      <Row gap={8}>
        <span style={{ width: 4, height: 16, borderRadius: 3, background: "var(--accent)", flex: "0 0 auto" }} />
        <Disp size={15}>{children}</Disp>
      </Row>
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

// Shimmer placeholder shown while first data loads
export function Skeleton({ w = "100%", h = 14, r, style }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r != null ? r : 8, flex: "0 0 auto",
      background: "linear-gradient(90deg, var(--surface2) 25%, var(--line) 50%, var(--surface2) 75%)",
      backgroundSize: "200% 100%", animation: "tpShimmer 1.4s ease-in-out infinite",
      ...style,
    }} />
  );
}

// Generic first-load layout: title + hero card + a few list rows
export function SkeletonScreen() {
  return (
    <Col gap={14} style={{ padding: "calc(14px * var(--sp)) 16px 90px" }}>
      <Skeleton w={150} h={26} />
      <Card>
        <Col gap={10}>
          <Skeleton w="55%" h={17} />
          <Skeleton w="80%" h={13} />
          <Skeleton h={40} r={12} style={{ marginTop: 4 }} />
        </Col>
      </Card>
      <Skeleton w={110} h={15} style={{ marginTop: 6 }} />
      {[0, 1, 2].map((i) => (
        <Card key={i} pad={12}>
          <Row gap={10}>
            <Skeleton w={36} h={36} r="50%" />
            <Col gap={6} style={{ flex: 1 }}>
              <Skeleton w="45%" h={13} />
              <Skeleton w="70%" h={11} />
            </Col>
          </Row>
        </Card>
      ))}
    </Col>
  );
}

// Friendly in-flow empty state with an optional next action
export function EmptyState({ icon, title, sub, action, onAction }) {
  return (
    <Card pad={22} style={{ textAlign: "center" }}>
      {icon && <div aria-hidden style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>}
      <Body size={13.5} bold>{title}</Body>
      {sub && <Body size={12} dim style={{ marginTop: 3 }}>{sub}</Body>}
      {action && <Btn small ghost onClick={onAction} style={{ marginTop: 12 }}>{action}</Btn>}
    </Card>
  );
}

// Full-screen fetch-failure state with a retry action
export function ErrorState({ offline, onRetry }) {
  return (
    <Col gap={12} style={{ height: "100%", alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center" }}>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {offline
          ? <path d="M1.5 8.5a15 15 0 0 1 21 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M2 2l20 20" />
          : <path d="M12 8v5m0 3.5h.01M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />}
      </svg>
      <Disp size={19}>{offline ? "Kamu sedang offline" : "Gagal memuat data"}</Disp>
      <Body size={13.5} dim style={{ maxWidth: 260 }}>
        {offline
          ? "Periksa koneksi internetmu — data akan dimuat ulang otomatis saat kembali online."
          : "Ada masalah saat mengambil data. Coba lagi sebentar lagi."}
      </Body>
      {onRetry && <Btn small primary onClick={onRetry} style={{ marginTop: 6 }}>Coba lagi</Btn>}
    </Col>
  );
}

// Bottom sheet modal — stays mounted briefly on close so it can animate out
export function Sheet({ open, onClose, children, title }) {
  const [shown, setShown] = React.useState(open);
  const closing = shown && !open;
  React.useEffect(() => {
    if (open) { setShown(true); return; }
    if (!shown) return;
    const t = setTimeout(() => setShown(false), 190);
    return () => clearTimeout(t);
  }, [open, shown]);
  if (!shown) return null;
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 60,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
      animation: closing ? "tpFade .19s ease reverse forwards" : "tpFade .18s ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{
        background: "var(--bg)", borderRadius: "24px 24px 0 0",
        borderTop: "1.5px solid var(--cage)",
        padding: "10px 18px calc(26px + env(safe-area-inset-bottom))",
        animation: closing ? "tpDown .19s ease forwards" : "tpUp .25s cubic-bezier(.2,.9,.3,1)",
        boxShadow: "0 -18px 50px rgba(5,8,22,0.5)",
        maxHeight: "85%", overflowY: "auto",
      }}>
        <div style={{ width: 42, height: 5, borderRadius: 3, background: "var(--accent)", opacity: 0.85, margin: "0 auto 12px" }} />
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
      zIndex: 80, background: "var(--surface)", border: "1.5px solid var(--cage)",
      color: "var(--text)", borderRadius: 18, padding: "9px 18px",
      fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
      boxShadow: "var(--shadow-brand)", maxWidth: "min(86%, 360px)",
      width: "max-content", textAlign: "center",
      animation: "tpUp .25s ease",
    }} role="status" aria-live="polite">{msg}</div>
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
      position: "relative", borderTop: "1.5px solid var(--cage)", background: "var(--bg-solid)",
      display: "flex", justifyContent: "space-around",
      padding: "8px 4px calc(6px + env(safe-area-inset-bottom))",
    }}>
      {items.map(([id, label, d]) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} aria-current={active ? "page" : undefined} className="tp-press" style={{
            background: "none", border: "none", cursor: "pointer", padding: "2px 8px",
            position: "relative",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            color: active ? "var(--accent-text)" : "var(--text2)",
            transition: "color .15s",
          }}>
            {/* lime court-line indicator over the active tab */}
            <span style={{
              position: "absolute", top: -9, width: 18, height: 3, borderRadius: 3,
              background: "var(--accent)", opacity: active ? 1 : 0, transition: "opacity .18s",
            }} />
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.3 : 1.9} strokeLinecap="round" strokeLinejoin="round">
              <path d={d} />
            </svg>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: active ? 700 : 600 }}>{label}</span>
          </button>
        );
      })}
      {onFab && <button onClick={onFab} title="Create match" aria-label="Create match" className="tp-press" style={{
        position: "absolute", right: 14, top: -26, width: 54, height: 54, borderRadius: "50%",
        background: "var(--accent)", border: "3px solid var(--bg-solid)", cursor: "pointer",
        boxShadow: "0 8px 22px var(--accent-soft), 0 4px 14px rgba(5,8,22,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ stroke: "var(--accent-ink)" }} strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>}
    </div>
  );
}
