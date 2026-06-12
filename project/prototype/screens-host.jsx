// iPad host console — landscape tablet view for community hosts leading matches.
// Shares live/standings state with the phone app.

function IPadFrame({ children, dark, width = 1194, height = 834 }) {
  return (
    <div style={{
      width, height, borderRadius: 38, overflow: "hidden", position: "relative",
      background: dark ? "#000" : "#F2F2F7",
      boxShadow: "0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12), 0 0 0 14px #1c1c1e, 0 0 0 15.5px #3a3a3c",
      boxSizing: "border-box",
    }}>
      {/* status bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 24, zIndex: 50,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 24px 0", pointerEvents: "none",
        fontFamily: "-apple-system, system-ui", fontSize: 12.5, fontWeight: 600,
        color: dark ? "#fff" : "#000",
      }}>
        <span>21:14 Jum 13 Jun</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span>📶</span><span>100%</span>
          <span style={{ display: "inline-block", width: 22, height: 11, border: "1px solid currentColor", borderRadius: 3, position: "relative" }}>
            <span style={{ position: "absolute", inset: 1.5, background: "currentColor", borderRadius: 1 }}></span>
          </span>
        </span>
      </div>
      <div style={{ height: "100%" }}>{children}</div>
      {/* home indicator */}
      <div style={{ position: "absolute", bottom: 7, left: "50%", transform: "translateX(-50%)", width: 220, height: 5, borderRadius: 100, background: dark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.25)", zIndex: 60 }}></div>
    </div>
  );
}

function HostCourtCard({ court, idx, A, target }) {
  const leadA = court.a >= court.b;
  const done = court.a >= target || court.b >= target;
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12, borderColor: done ? "var(--accent)" : "var(--line)" }} pad={18}>
      <Row style={{ justifyContent: "space-between" }}>
        <Body size={12} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>Court {idx + 1}</Body>
        {done
          ? <Pill small on>Game point reached</Pill>
          : <Body size={12} dim>to {target}</Body>}
      </Row>
      {[["A", court.teamA, court.a, leadA], ["B", court.teamB, court.b, !leadA]].map(([side, team, score, leading]) => (
        <Row key={side} gap={12} style={{
          background: "var(--surface2)", borderRadius: 14, padding: "12px 14px",
          outline: leading && (court.a !== court.b) ? "1.5px solid var(--accent)" : "1.5px solid transparent",
        }}>
          <Body size={16} bold style={{ flex: 1 }}>{team}</Body>
          <Num size={38}>{score}</Num>
          <Col gap={6}>
            <Btn small primary onClick={() => A.scoreCourt(court.id, side, 1)} style={{ minWidth: 64 }}>+1</Btn>
            <Btn small ghost onClick={() => A.scoreCourt(court.id, side, -1)} style={{ minWidth: 64 }}>−</Btn>
          </Col>
        </Row>
      ))}
    </Card>
  );
}

function HostConsole({ S, A, t }) {
  const target = 21;
  const allDone = S.live.courts.every((c) => c.a >= target || c.b >= target);
  const nextPairs = [
    ["Rina / Andre", "Tomy / Eko"],
    ["Dina / Bayu", "Maya / Dimas"],
    ["Sari / Raka", "Fitri + walk-in"],
  ];
  return (
    <div style={{ ...tpTheme(t), background: "var(--bg)", height: "100%", display: "flex", boxSizing: "border-box", paddingTop: 24 }}>
      {/* left rail — event context */}
      <div style={{ width: 252, flex: "0 0 252px", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 14, padding: "18px 16px 44px", boxSizing: "border-box" }}>
        <Row gap={10}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>🎾</div>
          <Col gap={1}>
            <Body size={11} dim bold style={{ letterSpacing: "0.08em" }}>HOST CONSOLE</Body>
            <Disp size={15}>Ternak Padel</Disp>
          </Col>
        </Row>
        <Card accent pad={14}>
          <Row gap={7} style={{ marginBottom: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", animation: "tpPulse 1.2s infinite" }}></span>
            <Body size={11.5} bold color="var(--accent-text)">LIVE</Body>
          </Row>
          <Disp size={17}>Friday Night Americano</Disp>
          <Body size={12} dim style={{ marginTop: 3 }}>Padel Pro SCBD · 3 courts aktif</Body>
        </Card>
        <Row gap={8}>
          <Card pad={11} style={{ flex: 1, textAlign: "center" }}>
            <Num size={20}>{S.live.round}<span style={{ fontSize: 13, color: "var(--text2)" }}>/7</span></Num>
            <Body size={10} dim bold style={{ marginTop: 3, textTransform: "uppercase" }}>Round</Body>
          </Card>
          <Card pad={11} style={{ flex: 1, textAlign: "center" }}>
            <Num size={20}>12<span style={{ fontSize: 13, color: "var(--text2)" }}>/12</span></Num>
            <Body size={10} dim bold style={{ marginTop: 3, textTransform: "uppercase" }}>Checked in</Body>
          </Card>
        </Row>
        <Card pad={12}>
          <Body size={11} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Round timer</Body>
          <Row style={{ justifyContent: "space-between" }}>
            <Num size={26}>12:42</Num>
            <Btn small ghost onClick={() => A.toast("Timer paused")}>⏸</Btn>
          </Row>
          <div style={{ height: 5, borderRadius: 3, background: "var(--surface2)", marginTop: 9, overflow: "hidden" }}>
            <div style={{ width: "64%", height: "100%", background: "var(--accent)" }}></div>
          </div>
        </Card>
        <Col gap={8} style={{ marginTop: "auto" }}>
          <Btn full ghost onClick={() => A.toast("Walk-in added — pairings rebalanced")}>+ Add walk-in player</Btn>
          <Btn full ghost onClick={() => A.toast("Announcement sent to all phones 📣")}>📣 Announce to players</Btn>
        </Col>
      </div>

      {/* center — courts */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "18px 18px 44px", boxSizing: "border-box", overflowY: "auto" }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Disp size={21}>Courts — Round {S.live.round}</Disp>
          <Body size={12.5} dim>Tap +1 to score · syncs to every phone instantly</Body>
        </Row>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {S.live.courts.map((c, i) => (
            <HostCourtCard key={c.id} court={c} idx={i} A={A} target={target}></HostCourtCard>
          ))}
          <Card pad={18} style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 8, borderStyle: "dashed", minHeight: 180 }}>
            <Body size={13} dim>Court 4 — resting</Body>
            <Body size={12.5} dim style={{ textAlign: "center" }}>Sari, Raka, Fitri, Eko<br></br>back in next round</Body>
          </Card>
        </div>
        <Btn primary full onClick={A.endRound} style={{ padding: "16px 18px", fontSize: 16, opacity: allDone ? 1 : 0.9 }}>
          {allDone ? "End round " + S.live.round + " → generate Round " + (S.live.round + 1) + " pairings" : "End round early → next pairings"}
        </Btn>
      </div>

      {/* right rail — standings + next */}
      <div style={{ width: 264, flex: "0 0 264px", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 12, padding: "18px 16px 44px", boxSizing: "border-box", overflowY: "auto" }}>
        <SecHead right="live ↻">Standings</SecHead>
        <Card pad={6}>
          {S.standings.map((p, i) => (
            <Row key={p.name} gap={9} style={{ padding: "7px 8px", borderRadius: 10, background: p.me ? "var(--accent-soft)" : "transparent" }}>
              <Num size={13} style={{ width: 16 }} color={i < 3 ? "var(--accent-text)" : "var(--text2)"}>{i + 1}</Num>
              <Ava ini={p.ini} d={24}></Ava>
              <Body size={12.5} bold={p.me} style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name.split(" ")[0]} {p.name.split(" ")[1] ? p.name.split(" ")[1][0] + "." : ""}</Body>
              <Num size={13}>{p.pts}</Num>
            </Row>
          ))}
        </Card>
        <SecHead>Next round preview</SecHead>
        <Col gap={7}>
          {nextPairs.map(([a, b], i) => (
            <Card key={i} pad={11}>
              <Body size={10.5} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Court {i + 1}</Body>
              <Body size={12.5} bold>{a}</Body>
              <Body size={11.5} dim style={{ margin: "1px 0" }}>vs</Body>
              <Body size={12.5} bold>{b}</Body>
            </Card>
          ))}
        </Col>
        <Body size={11} dim style={{ textAlign: "center" }}>Smart matchmaking: balanced by live standings & partner history</Body>
      </div>
    </div>
  );
}

Object.assign(window, { IPadFrame, HostConsole });
