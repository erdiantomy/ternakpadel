// Wireframe sketch primitives for Ternak Padel exploration.
// Sketchy, lo-fi look: rough borders, scribble text, marker highlights.
// Exports to window at bottom.

const WF = {
  ink: "#2b2b2b",
  faint: "#9a9a9a",
  paper: "#fdfcf8",
  marker: "#FF6B00",
};

// Hand-drawn-ish border radius trick
const roughBorder = (w = 1.5) => ({
  border: `${w}px solid ${WF.ink}`,
  borderRadius: "255px 15px 225px 15px / 15px 225px 15px 255px",
});

function SBox({ w, h, style, children, dashed, fill, pad = 8, label }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        boxSizing: "border-box",
        padding: pad,
        position: "relative",
        background: fill || "transparent",
        ...roughBorder(dashed ? 1.2 : 1.5),
        borderStyle: dashed ? "dashed" : "solid",
        ...style,
      }}
    >
      {label && (
        <span style={{ position: "absolute", top: 2, left: 8, fontSize: 10, color: WF.faint, fontFamily: "'Caveat', cursive" }}>
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

// Scribble lines = placeholder text
function Scribble({ lines = 2, w = "100%", gap = 5, h = 5, last = "60%", color }) {
  const arr = Array.from({ length: lines });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, width: w }}>
      {arr.map((_, i) => (
        <div
          key={i}
          style={{
            height: h,
            width: i === arr.length - 1 && lines > 1 ? last : "100%",
            background: color || "#cfcdc6",
            borderRadius: 3,
          }}
        ></div>
      ))}
    </div>
  );
}

function SText({ size = 13, bold, children, color, style, marker }) {
  return (
    <div
      style={{
        fontFamily: "'Patrick Hand', cursive",
        fontSize: size,
        fontWeight: bold ? 700 : 400,
        color: color || WF.ink,
        lineHeight: 1.25,
        background: marker ? "linear-gradient(transparent 45%, rgba(255,107,0,0.35) 45%, rgba(255,107,0,0.35) 90%, transparent 90%)" : "none",
        display: marker ? "inline" : "block",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SCircle({ d = 28, style, children, fill }) {
  return (
    <div
      style={{
        width: d,
        height: d,
        flex: `0 0 ${d}px`,
        borderRadius: "50%",
        border: `1.5px solid ${WF.ink}`,
        background: fill || "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Patrick Hand', cursive",
        fontSize: d * 0.4,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// X-crossed image placeholder
function SImage({ w = "100%", h = 60, label, style }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        border: `1.5px solid ${WF.ink}`,
        borderRadius: "255px 15px 225px 15px / 15px 225px 15px 255px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(to top right, transparent calc(50% - 1px), #c9c7c0 50%, transparent calc(50% + 1px)), linear-gradient(to bottom right, transparent calc(50% - 1px), #c9c7c0 50%, transparent calc(50% + 1px))",
        ...style,
      }}
    >
      {label && (
        <span style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: WF.faint, background: WF.paper, padding: "0 6px" }}>
          {label}
        </span>
      )}
    </div>
  );
}

function SBtn({ children, primary, w, small }) {
  return (
    <div
      style={{
        ...roughBorder(1.5),
        width: w,
        boxSizing: "border-box",
        padding: small ? "3px 10px" : "6px 14px",
        textAlign: "center",
        fontFamily: "'Patrick Hand', cursive",
        fontSize: small ? 11 : 13,
        background: primary ? "rgba(255,107,0,0.3)" : "transparent",
        fontWeight: primary ? 700 : 400,
      }}
    >
      {children}
    </div>
  );
}

function SPill({ children, on }) {
  return (
    <div
      style={{
        border: `1.3px solid ${on ? WF.ink : "#b5b3ac"}`,
        borderRadius: 999,
        padding: "2px 10px",
        fontFamily: "'Patrick Hand', cursive",
        fontSize: 11,
        background: on ? "rgba(255,107,0,0.25)" : "transparent",
        color: on ? WF.ink : WF.faint,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

// Row of avatar circles
function SAvatars({ n = 3, d = 22 }) {
  return (
    <div style={{ display: "flex" }}>
      {Array.from({ length: n }).map((_, i) => (
        <SCircle key={i} d={d} fill={WF.paper} style={{ marginLeft: i ? -d * 0.3 : 0 }}>
          <span style={{ fontSize: 9, color: WF.faint }}>:)</span>
        </SCircle>
      ))}
    </div>
  );
}

// Phone wireframe shell (lo-fi, not a real bezel)
function Phone({ children, title, w = 250, h = 500, noNav, fab, navActive = 0 }) {
  const navItems = ["Home", "Events", "Match", "Rank", "Me"];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: w,
          height: h,
          boxSizing: "border-box",
          background: WF.paper,
          border: `2px solid ${WF.ink}`,
          borderRadius: 22,
          padding: "10px 10px 0",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          fontFamily: "'Patrick Hand', cursive",
        }}
      >
        {/* status bar */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: WF.faint, padding: "0 4px 6px" }}>
          <span>9:41</span>
          <span>▮▮▮</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
        {!noNav && (
          <div
            style={{
              borderTop: `1.5px solid ${WF.ink}`,
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              padding: "6px 0 8px",
              marginTop: 6,
              position: "relative",
            }}
          >
            {navItems.map((t, i) => (
              <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                <div
                  style={{
                    width: 13,
                    height: 13,
                    border: `1.4px solid ${i === navActive ? WF.ink : "#b5b3ac"}`,
                    borderRadius: 4,
                    background: i === navActive ? "rgba(255,107,0,0.35)" : "transparent",
                  }}
                ></div>
                <span style={{ fontSize: 8, color: i === navActive ? WF.ink : WF.faint }}>{t}</span>
              </div>
            ))}
            {fab && (
              <SCircle d={34} fill="rgba(255,107,0,0.4)" style={{ position: "absolute", right: 10, top: -42, borderWidth: 2 }}>
                +
              </SCircle>
            )}
          </div>
        )}
      </div>
      {title && (
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: WF.ink }}>{title}</div>
      )}
    </div>
  );
}

// Annotation note (toggleable via tweaks)
function Note({ children, style }) {
  if (!window.__wfShowNotes) return null;
  return (
    <div
      style={{
        fontFamily: "'Caveat', cursive",
        fontSize: 14,
        color: "#b3551c",
        lineHeight: 1.15,
        maxWidth: 150,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Section header inside a phone
function SHead({ children, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <SText size={12} bold>{children}</SText>
      {right && <SText size={10} color={WF.faint}>{right}</SText>}
    </div>
  );
}

// Simple sketchy bar chart
function SBars({ vals = [4, 7, 5, 9, 6], w = "100%", h = 40, hi = -1 }) {
  const max = Math.max(...vals);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, width: w, height: h }}>
      {vals.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            border: `1.3px solid ${WF.ink}`,
            borderBottom: "none",
            background: i === hi ? "rgba(255,107,0,0.4)" : "rgba(0,0,0,0.05)",
            borderRadius: "4px 4px 0 0",
          }}
        ></div>
      ))}
    </div>
  );
}

// Sketchy line chart (ranking history)
function SLine({ w = "100%", h = 44 }) {
  return (
    <svg viewBox="0 0 100 40" style={{ width: w, height: h, display: "block" }} preserveAspectRatio="none">
      <polyline
        points="2,32 18,28 32,30 46,20 60,23 74,12 88,15 98,6"
        fill="none"
        stroke={WF.ink}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      ></polyline>
      <circle cx="98" cy="6" r="3" fill={WF.marker}></circle>
    </svg>
  );
}

// Leaderboard row
function SRankRow({ pos, name, pts, me }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "3px 5px",
        background: me ? "rgba(255,107,0,0.18)" : "transparent",
        borderRadius: 6,
      }}
    >
      <SText size={12} bold style={{ width: 18 }}>{pos}</SText>
      <SCircle d={18}></SCircle>
      <SText size={12} style={{ flex: 1 }}>{name}</SText>
      <SText size={12} bold>{pts}</SText>
    </div>
  );
}

// Arrow connector between storyboard frames
function FlowArrow({ label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: "0 2px", alignSelf: "center" }}>
      <span style={{ fontFamily: "'Caveat', cursive", fontSize: 13, color: "#b3551c" }}>{label || ""}</span>
      <span style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 22, color: "#2b2b2b" }}>⟶</span>
    </div>
  );
}

Object.assign(window, {
  WF, SBox, Scribble, SText, SCircle, SImage, SBtn, SPill, SAvatars,
  Phone, Note, SHead, SBars, SLine, SRankRow, FlowArrow, roughBorder,
});
