import React from "react";
import { supabase } from "../lib/supabase.js";
import { tpTheme } from "../theme.js";
import { Disp, Body, Num, Card, Ava, Row, Col, Seg } from "../components/atoms.jsx";
import { CourtBadge } from "../components/BrandMark.jsx";

// Public shareable leaderboard — /board/<eventId>. No login required: reads go
// through the anon-callable session_board / club_board RPCs (0017 migration),
// which expose only display names and scores. Polls while the session is live;
// once the session is finished the board renders as FINAL (locked).

const initialsOf = (name) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

function BoardRows({ rows, statCols }) {
  if (!rows || rows.length === 0) {
    return <Body size={13} dim style={{ padding: "10px 8px" }}>No scores yet — standings appear here live as matches are played.</Body>;
  }
  return rows.map((r, i) => (
    <Row key={r.key || r.name + i} gap={10} style={{
      padding: "8px 8px", borderRadius: 10,
      background: i === 0 ? "var(--accent-soft)" : "transparent",
    }}>
      <Num size={14} style={{ width: 22 }} color={i < 3 ? "var(--accent-text)" : "var(--text2)"}>{i + 1}</Num>
      <Ava ini={initialsOf(r.name)} d={28} ring={i === 0} />
      <Body size={13.5} bold={i < 3} style={{ flex: 1, minWidth: 0 }}>{r.name}</Body>
      <Body size={11.5} dim style={{ whiteSpace: "nowrap" }}>{statCols(r)}</Body>
      <Num size={15} style={{ minWidth: 30, textAlign: "right" }}>{r.pts}</Num>
    </Row>
  ));
}

export default function SessionBoard({ eventId }) {
  const [view, setView] = React.useState("session");
  const [board, setBoard] = React.useState(null); // session_board payload
  const [club, setClub] = React.useState(null);   // club_board payload
  const [failed, setFailed] = React.useState(false);

  const load = React.useCallback(async () => {
    const [s, c] = await Promise.all([
      supabase.rpc("session_board", { p_event_id: eventId }),
      supabase.rpc("club_board"),
    ]);
    if (!s.error && s.data) { setBoard(s.data); setFailed(false); }
    else if (!board) setFailed(true);
    if (!c.error && c.data) setClub(c.data);
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = board?.event?.status === "done";
  React.useEffect(() => {
    load();
    // live sessions refresh fast; a finished (locked) board only re-checks
    // occasionally in case the organizer reopens it
    const t = setInterval(load, done ? 60000 : 5000);
    return () => clearInterval(t);
  }, [load, done]);

  const theme = tpTheme({ theme: "dark", accent: "#C4F22E", font: "brand", density: "comfy" });
  const ev = board?.event;
  const dateLine = ev?.starts_at
    ? new Date(ev.starts_at).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <div style={{ minHeight: "100dvh", background: "#070B1C", display: "flex", justifyContent: "center" }}>
      <div style={{
        ...theme, background: "var(--bg)", width: "100%", maxWidth: 480, minHeight: "100dvh",
        display: "flex", flexDirection: "column", boxShadow: "0 0 0 1px var(--line)",
      }}>
        <div style={{ height: "env(safe-area-inset-top)" }} />
        <Col gap={12} style={{ padding: "18px 16px calc(28px + env(safe-area-inset-bottom))", flex: 1 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Row gap={10}>
              <CourtBadge size={38} />
              <Col gap={1}>
                <Body size={11} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>Ternak Padel</Body>
                <Body size={12.5} bold>Leaderboard</Body>
              </Col>
            </Row>
            {ev && (
              <Row gap={6} style={{
                background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, padding: "5px 11px",
              }}>
                {!done && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", animation: "tpPulse 1.2s infinite" }} />}
                <Body size={11.5} bold>{done ? "FINAL 🔒" : "LIVE"}</Body>
              </Row>
            )}
          </Row>

          {failed && !board && (
            <Card pad={16}>
              <Body size={13.5} dim>Leaderboard not found. Check the link, or ask the organizer to share it again.</Body>
            </Card>
          )}

          {ev && (
            <Col gap={2}>
              <Disp size={22}>{ev.title}</Disp>
              <Body size={12.5} dim>
                {ev.venue}{dateLine ? " · " + dateLine : ""} · round {ev.rounds_played}/{ev.rounds_planned}
              </Body>
            </Col>
          )}

          <Seg options={["session", "all-time"]} value={view} onChange={setView} />

          {view === "session" ? (
            <Card pad={8}>
              <BoardRows rows={board?.rows} statCols={(r) => `${r.wins}W · ${r.played}P`} />
            </Card>
          ) : (
            <React.Fragment>
              <Card pad={8}>
                <BoardRows rows={club?.rows} statCols={(r) => `${r.wins}W · ${r.sessions}S`} />
              </Card>
              <Body size={11} dim style={{ textAlign: "center" }}>
                Accumulated across all finished sessions — a session counts once its organizer finishes it.
              </Body>
            </React.Fragment>
          )}

          <div style={{ flex: 1 }} />
          <Body size={11.5} dim style={{ textAlign: "center" }}>
            {done ? "Final result · " : "Updates live · "}ternakpadel.xyz
          </Body>
        </Col>
      </div>
    </div>
  );
}
