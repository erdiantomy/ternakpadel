import React from "react";
import { Disp, Body, Num, Card, Ava, Btn, Row, Col, SecHead, MicroLabel, LiveDot, HeaderPill, LeaderboardRow, EmptyState, Icon } from "../components/atoms.jsx";
import { VENUE_DEFAULT, courtName } from "../lib/courts.js";
import { StatusBadge } from "./SessionManager.jsx";

// Matches tab: live event (spectator courts + scorer mode + standings).

export function MatchesScreen({ S, A }) {
  const live = S.live;
  if (!live || !live.courts.length) {
    return (
      <Col gap={12} style={{ padding: "calc(14px * var(--sp)) 16px 90px" }}>
        <Disp size={24}>Matches</Disp>
        <Body size={13.5} dim>No live event right now. Join an event and come back when it starts — courts and scores show up here in real time.</Body>
      </Col>
    );
  }
  return (
    <Col gap={12} style={{ padding: "calc(14px * var(--sp)) 16px 90px" }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Disp size={24}>Matches</Disp>
        <StatusBadge status={live.status} />
      </Row>
      <Body size={12.5} bold dim style={{ marginTop: -6 }}>Round {live.round}/{live.totalRounds || 7}</Body>
      <Body size={13} dim style={{ marginTop: -8 }}>{live.title || "Friday Night Americano"} · {live.venue || VENUE_DEFAULT}</Body>

      {live.courts.map((c, i) => (
        <Card key={c.id} accent={c.yours} onClick={c.yours ? () => A.setScorer(true) : undefined}>
          <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <MicroLabel>{courtName(c.court || i + 1)}{c.yours ? " · your match" : ""}</MicroLabel>
            {c.yours && <Body size={12} bold color="var(--accent-text)">Score it →</Body>}
          </Row>
          <Col gap={6}>
            <Row style={{ justifyContent: "space-between" }}>
              <Body size={14} bold={c.a >= c.b} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.teamA}</Body>
              <Num size={22} style={{ flex: "0 0 auto" }} color={c.a >= c.b ? "var(--text)" : "var(--text2)"}>{c.a}</Num>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Body size={14} bold={c.b > c.a} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.teamB}</Body>
              <Num size={22} style={{ flex: "0 0 auto" }} color={c.b > c.a ? "var(--text)" : "var(--text2)"}>{c.b}</Num>
            </Row>
          </Col>
        </Card>
      ))}

      <SecHead right="live ↻" onRight={() => window.open("/board/" + live.eventId, "_blank")}>Event standings</SecHead>
      <Card pad={8}>
        {S.standings.map((p, i) => (
          <LeaderboardRow key={p.name} rank={i + 1} ini={p.ini}
            name={p.name + (p.me ? " (you)" : "")} pts={p.pts} hi={p.me} bold={p.me} />
        ))}
      </Card>
      <Btn small full ghost onClick={() => window.open("/board/" + live.eventId, "_blank")}>
        <Icon name="link" size={13} /> Open shareable leaderboard
      </Btn>
    </Col>
  );
}

export function ScorerOverlay({ S, A }) {
  const c = S.live?.courts.find((x) => x.yours);
  if (!S.scorer || !c) return null;
  const done = S.matchResult;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, background: "var(--bg)", display: "flex", flexDirection: "column", animation: "tpFade .15s" }}>
      <Row style={{ justifyContent: "space-between", padding: "calc(14px + env(safe-area-inset-top)) 16px 14px" }}>
        <HeaderPill onClick={() => A.setScorer(false)}>↓ Close</HeaderPill>
        <Row gap={6}>
          <LiveDot />
          <Body size={12.5} bold>{courtName(c.court || 1)} · Round {S.live.round} · to {c.target || 21}</Body>
        </Row>
      </Row>

      {!done ? (
        <React.Fragment>
          <Col gap={0} style={{ flex: 1, justifyContent: "center", padding: "0 16px", gap: 12 }}>
            {[["A", c.teamA, c.a], ["B", c.teamB, c.b]].map(([side, team, score]) => (
              <Card key={side} accent={side === "A"} pad={18}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Col gap={3}>
                    <MicroLabel size={12}>{side === (c.mySide || "A") ? "Your team" : "Opponents"}</MicroLabel>
                    <Body size={16} bold>{team}</Body>
                  </Col>
                  <Num size={52}>{score}</Num>
                </Row>
                <Row gap={8} style={{ marginTop: 12 }}>
                  <Btn ghost small style={{ flex: 1 }} onClick={() => A.score(side, -1)}>−</Btn>
                  <Btn primary small style={{ flex: 2 }} onClick={() => A.score(side, 1)}>+1 point</Btn>
                </Row>
              </Card>
            ))}
          </Col>
          <div style={{ padding: "16px 16px calc(16px + env(safe-area-inset-bottom))" }}>
            <Btn full ghost onClick={A.endMatch}>End match</Btn>
          </div>
        </React.Fragment>
      ) : (
        <Col gap={14} style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 52, animation: "tpPop .4s cubic-bezier(.2,1.4,.4,1)" }}>{done.won ? "🏆" : "🤝"}</div>
          <Disp size={28}>{done.won ? "Victory!" : "Good fight"}</Disp>
          <Num size={40} color="var(--accent-text)">{done.a}–{done.b}</Num>
          <Body size={14} dim>
            {done.won
              ? "+" + (done.pts || 12) + " ranking points · streak W" + S.streak + (S.rank < done.prevRank ? " · Rank #" + done.prevRank + " → #" + S.rank + " 🎉" : "")
              : "+2 participation points · streak reset"}
          </Body>
          <Col gap={8} style={{ width: "100%", marginTop: 8 }}>
            {done.won && <Btn primary full onClick={() => A.openShare("victory")}>Share victory card</Btn>}
            <Btn full ghost onClick={A.closeScorer}>Back to courts</Btn>
          </Col>
        </Col>
      )}
    </div>
  );
}

// ---------- Rankings ----------

export function RankingsScreen({ S }) {
  const season = (S.seasons || []).find((s) => s.now);
  const sorted = S.players.slice().sort((a, b) => b.pts - a.pts);
  const hasPodium = sorted.length >= 3;
  const podium = sorted.slice(0, 3);
  const rest = hasPodium ? sorted.slice(3) : sorted;
  const order = hasPodium ? [podium[1], podium[0], podium[2]] : [];
  const hs = [64, 84, 52];
  return (
    <Col gap={12} style={{ padding: "calc(14px * var(--sp)) 16px 90px" }}>
      <Row style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <Disp size={24}>Leaderboard</Disp>
        {season && <MicroLabel>{season.name}</MicroLabel>}
      </Row>
      {sorted.length === 0 && (
        <EmptyState icon="🏆" title="No ranked players yet"
          sub="Play a session — points land here the moment a match finishes." />
      )}
      {hasPodium && <Row gap={10} style={{ alignItems: "flex-end", justifyContent: "center", padding: "8px 0 2px" }}>
        {order.map((p, i) => (
          <Col key={p.id} gap={5} style={{ alignItems: "center", flex: 1 }}>
            <Ava ini={p.initials} d={i === 1 ? 46 : 38} ring={i === 1} />
            <Body size={12} bold style={{ textAlign: "center" }}>{p.name.split(" ")[0]}</Body>
            <div style={{
              width: "100%", height: hs[i], borderRadius: "10px 10px 0 0",
              background: i === 1 ? "var(--accent)" : "var(--surface2)",
              display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 6,
            }}>
              <Num size={17} color={i === 1 ? "var(--accent-ink)" : "var(--text2)"}>{i === 1 ? 1 : i === 0 ? 2 : 3}</Num>
            </div>
          </Col>
        ))}
      </Row>}
      {rest.length > 0 && (
        <Card pad={8}>
          {rest.map((p, i) => (
            <LeaderboardRow key={p.id} rank={i + (hasPodium ? 4 : 1)} ini={p.initials} ring={p.me}
              name={p.name + (p.me ? " (you)" : "")} pts={p.pts} hi={p.me} bold={p.me} topAccent={!hasPodium}
              extra={p.me && S.rankDelta > 0 ? <Body size={12} bold color="var(--success)">↑{S.rankDelta}</Body> : null} />
          ))}
        </Card>
      )}
      {sorted.length > 0 && (
        <Body size={11.5} dim style={{ textAlign: "center" }}>
          Points accumulate across every session{season ? " · " + season.name : ""}
        </Body>
      )}
    </Col>
  );
}
