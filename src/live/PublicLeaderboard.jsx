import React from "react";
import { supabase } from "../lib/supabase.js";
import { tpTheme } from "../theme.js";
import { Disp, Body, Num, Card, Ava, Row, Col } from "../components/atoms.jsx";
import { CourtBadge } from "../components/BrandMark.jsx";

// Public, read-only live leaderboard for a shared session. No login required.
// Reachable at /s/<share_token>. All data comes from the SECURITY DEFINER
// public_session_board RPC, which returns ONLY non-PII leaderboard fields
// (name, points, rank) plus round/status — never phone/email/account ids.
//
// "Live": Supabase Realtime does not expose the raw matches table to anonymous
// viewers (that would leak account ids), so we keep the board fresh by polling
// the safe RPC on a short interval and on window focus. Scores/ranking update
// on their own with no manual refresh.

const initialsOf = (name) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

const THEME = { theme: "dark", accent: "#C4F22E", font: "brand", density: "comfy" };
const POLL_MS = 5000;

export default function PublicLeaderboard({ token }) {
  const [board, setBoard] = React.useState(undefined); // undefined=loading, null=not found
  const theme = tpTheme(THEME);

  const load = React.useCallback(async () => {
    if (!supabase || !token) { setBoard(null); return; }
    const { data, error } = await supabase.rpc("public_session_board", { p_token: token });
    if (error) { setBoard((b) => (b === undefined ? null : b)); return; }
    setBoard(data ?? null);
  }, [token]);

  React.useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const shell = (children) => (
    <div style={{ minHeight: "100dvh", background: "#070B1C", display: "flex", justifyContent: "center" }}>
      <div style={{
        ...theme, background: "var(--bg)", width: "100%", maxWidth: 480, minHeight: "100dvh",
        display: "flex", flexDirection: "column", boxShadow: "0 0 0 1px var(--line)",
      }}>
        <div style={{ height: "env(safe-area-inset-top)" }} />
        {children}
      </div>
    </div>
  );

  if (board === undefined) {
    return shell(
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ animation: "tpPulse 1.2s infinite" }}><CourtBadge size={48} /></div>
      </div>
    );
  }

  if (board === null) {
    return shell(
      <Col gap={10} style={{ flex: 1, alignItems: "center", justifyContent: "center", textAlign: "center", padding: 28 }}>
        <CourtBadge size={44} />
        <Disp size={22}>Leaderboard not found</Disp>
        <Body size={13.5} dim>This share link is invalid or sharing was turned off by the host.</Body>
      </Col>
    );
  }

  const ev = board.event || {};
  const rows = board.rows || [];
  const liveDot = ev.status === "live";

  return shell(
    <Col gap={12} style={{ padding: "calc(16px) 16px calc(28px + env(safe-area-inset-bottom))" }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Row gap={9}><CourtBadge size={26} /><Body size={11.5} bold dim style={{ letterSpacing: "0.12em" }}>TERNAK PADEL</Body></Row>
        <Row gap={6}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: liveDot ? "var(--danger)" : "var(--text2)",
            animation: liveDot ? "tpPulse 1.2s infinite" : "none",
          }} />
          <Body size={11.5} bold>{liveDot ? "LIVE" : (ev.status || "").toUpperCase() || "—"}</Body>
        </Row>
      </Row>

      <Col gap={2}>
        <Disp size={24}>{ev.title || "Session"}</Disp>
        <Body size={12.5} dim>
          {ev.venue || ""}{ev.type ? " · " + ev.type : ""}
          {ev.round ? " · Round " + ev.round + (ev.total_rounds ? "/" + ev.total_rounds : "") : ""}
        </Body>
      </Col>

      {rows.length === 0 ? (
        <Body size={13.5} dim style={{ marginTop: 8 }}>No scores yet — standings appear here the moment the first match is scored.</Body>
      ) : (
        <Card pad={8}>
          {rows.map((p, i) => (
            <Row key={i} gap={10} style={{
              padding: "9px 8px", borderRadius: 10,
              background: i === 0 ? "var(--accent-soft)" : "transparent",
            }}>
              <Num size={15} style={{ width: 22 }} color={p.rank <= 3 ? "var(--accent-text)" : "var(--text2)"}>{p.rank}</Num>
              <Ava ini={initialsOf(p.name)} d={28} ring={i === 0} />
              <Body size={14} bold style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</Body>
              <Num size={15}>{p.pts}</Num>
            </Row>
          ))}
        </Card>
      )}

      <Body size={11} dim style={{ textAlign: "center", marginTop: 6 }}>Live standings · updates automatically</Body>
    </Col>
  );
}
