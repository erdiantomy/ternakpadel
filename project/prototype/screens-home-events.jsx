// Home (match-day hero + feed) and Events screens.

function FeedItem({ post, onLike }) {
  const kindIcon = { result: "🎾", rank: "📈", badge: "🏅", join: "📅" }[post.kind] || "🎾";
  return (
    <Card>
      <Row>
        <Ava ini={post.ini} d={34}></Ava>
        <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Body size={13.5}>
            <b>{post.who}</b> {post.text} {post.score && <b style={{ color: "var(--accent-text)" }}>{post.score}</b>}
          </Body>
          <Body size={11.5} dim>{post.time} · {post.sub}</Body>
        </Col>
        <Body size={16}>{kindIcon}</Body>
      </Row>
      <Row gap={16} style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
        <Row gap={5} onClick={() => onLike(post.id)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill={post.liked ? "var(--accent)" : "none"} stroke={post.liked ? "var(--accent)" : "var(--text2)"} strokeWidth="2">
            <path d="M12 21s-7.5-4.7-9.7-9A5.6 5.6 0 0 1 12 6.6 5.6 5.6 0 0 1 21.7 12c-2.2 4.3-9.7 9-9.7 9Z"></path>
          </svg>
          <Body size={12} bold dim={!post.liked} color={post.liked ? "var(--accent-text)" : undefined}>{post.likes + (post.liked ? 1 : 0)}</Body>
        </Row>
        <Row gap={5}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z"></path></svg>
          <Body size={12} dim>{post.comments}</Body>
        </Row>
        <Row gap={5} style={{ marginLeft: "auto" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13m0-13L8 7m4-4 4 4"></path></svg>
        </Row>
      </Row>
    </Card>
  );
}

function MatchDayHero({ ev, joined, onOpen, onCheckin, checkedIn }) {
  return (
    <Card accent onClick={onOpen} style={{ position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: -30, top: -30, width: 130, height: 130, borderRadius: "50%", background: "var(--accent-soft)" }}></div>
      <Col gap={8} style={{ position: "relative" }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Body size={11.5} bold color="var(--accent-text)" style={{ letterSpacing: "0.08em" }}>TODAY · 19:00</Body>
          <Body size={11.5} dim>{ev.joined + (joined ? 1 : 0)}/{ev.max} players</Body>
        </Row>
        <Disp size={22}>{ev.title}</Disp>
        <Body size={13} dim>{ev.venue} · {ev.courts} courts · +{ev.pts} pts</Body>
        <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
          <Row gap={0}>
            {["RW", "BN", "SK", "AH"].map((i, n) => (
              <div key={i} style={{ marginLeft: n ? -10 : 0 }}><Ava ini={i} d={28}></Ava></div>
            ))}
            <Body size={12} dim style={{ marginLeft: 7 }}>+{ev.joined - 4 + (joined ? 1 : 0)}</Body>
          </Row>
          {joined
            ? <Btn small primary={!checkedIn} ghost={checkedIn} onClick={(e) => { e.stopPropagation(); onCheckin(); }}>{checkedIn ? "✓ Checked in" : "Check in"}</Btn>
            : <Btn small primary onClick={(e) => { e.stopPropagation(); onOpen(); }}>Join · {rupiah(ev.fee)}</Btn>}
        </Row>
      </Col>
    </Card>
  );
}

function HomeScreen({ S, A, layout }) {
  const ev = S.events[0];
  const hero = (
    <MatchDayHero ev={ev} joined={S.joined[ev.id]} checkedIn={S.checkedIn}
      onOpen={() => A.openEvent(ev.id)} onCheckin={A.checkIn}></MatchDayHero>
  );
  const form = (
    <Row gap={8}>
      {[
        ["Streak", S.streak > 0 ? "W" + S.streak + " 🔥" : "—"],
        ["Win rate", S.winRate + "%"],
        ["Season", "#" + S.rank],
      ].map(([l, v]) => (
        <Card key={l} pad={"calc(11px * var(--sp))"} style={{ flex: 1 }}>
          <Body size={10.5} dim style={{ letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>{l}</Body>
          <Num size={19} style={{ marginTop: 4 }}>{v}</Num>
        </Card>
      ))}
    </Row>
  );
  const week = (
    <Col gap={8}>
      <SecHead right="All events →" onRight={() => A.setTab("events")}>This week</SecHead>
      {S.events.slice(1, 3).map((e) => (
        <Card key={e.id} onClick={() => A.openEvent(e.id)} pad={"calc(11px * var(--sp))"}>
          <Row style={{ justifyContent: "space-between" }}>
            <Row gap={10}>
              <Col gap={0} style={{ width: 34, textAlign: "center" }}>
                <Body size={10} dim bold>{e.day}</Body>
                <Num size={17}>{e.date}</Num>
              </Col>
              <Col gap={1}>
                <Body size={13.5} bold>{e.title}</Body>
                <Body size={11.5} dim>{e.venue.split(",")[0]} · {rupiah(e.fee)}</Body>
              </Col>
            </Row>
            {e.full && !S.joined[e.id] ? <Pill small>Full</Pill> : S.joined[e.id] ? <Pill small on>Joined</Pill> : <Body size={13} bold color="var(--accent-text)">Join →</Body>}
          </Row>
        </Card>
      ))}
    </Col>
  );
  const feed = (
    <Col gap={8}>
      <SecHead>Community</SecHead>
      {S.feed.map((p) => <FeedItem key={p.id} post={p} onLike={A.like}></FeedItem>)}
    </Col>
  );
  return (
    <Col gap={12} style={{ padding: "calc(14px * var(--sp)) 16px 90px" }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Col gap={1}>
          <Body size={12.5} dim>Selamat malam,</Body>
          <Disp size={21}>Tomy 👋</Disp>
        </Col>
        <Row gap={8}>
          <div style={{ position: "relative" }}>
            <Ava ini="TS" d={36} ring></Ava>
            <div style={{ position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: "50%", background: "var(--accent)" }}></div>
          </div>
        </Row>
      </Row>
      {layout === "feed" ? (
        <React.Fragment>{hero}{feed}{form}{week}</React.Fragment>
      ) : (
        <React.Fragment>{hero}{form}{week}{feed}</React.Fragment>
      )}
    </Col>
  );
}

// ---------- Events ----------

function EventsScreen({ S, A }) {
  const [filter, setFilter] = React.useState("All");
  const types = ["All", "Americano", "Mexicano", "League", "King of the Hill"];
  const list = S.events.filter((e) => filter === "All" || e.type === filter);
  return (
    <Col gap={12} style={{ padding: "calc(14px * var(--sp)) 16px 90px" }}>
      <Disp size={24}>Events</Disp>
      <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2 }}>
        {types.map((t) => <Pill key={t} small on={filter === t} onClick={() => setFilter(t)}>{t === "King of the Hill" ? "KOTH" : t}</Pill>)}
      </div>
      <Col gap={9}>
        {list.map((e) => (
          <Card key={e.id} onClick={() => A.openEvent(e.id)} accent={e.today}>
            <Row gap={12}>
              <Col gap={0} style={{ width: 44, textAlign: "center", background: "var(--surface2)", borderRadius: 11, padding: "7px 0" }}>
                <Body size={10} dim bold>{e.day}</Body>
                <Num size={19}>{e.date}</Num>
              </Col>
              <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Body size={14.5} bold>{e.title}</Body>
                <Body size={12} dim>{e.venue.split(",")[0]} · {rupiah(e.fee)} · +{e.pts} pts</Body>
                <Row gap={6} style={{ marginTop: 3 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 3, background: "var(--surface2)", overflow: "hidden" }}>
                    <div style={{ width: Math.round(((e.joined + (S.joined[e.id] ? 1 : 0)) / e.max) * 100) + "%", height: "100%", background: e.full ? "var(--danger)" : "var(--accent)" }}></div>
                  </div>
                  <Body size={11} dim>{e.joined + (S.joined[e.id] ? 1 : 0)}/{e.max}</Body>
                </Row>
              </Col>
              {S.joined[e.id] && <Pill small on>✓</Pill>}
            </Row>
          </Card>
        ))}
      </Col>
    </Col>
  );
}

function EventDetail({ S, A, ev }) {
  const joined = S.joined[ev.id];
  const names = { rina: "Rina", eko: "Eko", maya: "Maya", dimas: "Dimas", fitri: "Fitri", bayu: "Bayu", sari: "Sari", andre: "Andre", dina: "Dina", raka: "Raka" };
  return (
    <Col gap={12} style={{ padding: "0 0 90px" }}>
      <div style={{
        height: 130, background: "linear-gradient(135deg, var(--accent-soft), var(--surface2) 70%)",
        display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "12px 16px 14px",
      }}>
        <button onClick={A.back} style={{ alignSelf: "flex-start", background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 999, padding: "6px 13px", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Back</button>
        <Col gap={3}>
          <Row gap={6}>
            <Pill small on>{ev.type}</Pill>
            <Pill small>+{ev.pts} ranking pts</Pill>
          </Row>
          <Disp size={23}>{ev.title}</Disp>
        </Col>
      </div>
      <Col gap={12} style={{ padding: "0 16px" }}>
        <Row gap={8}>
          <Card pad={"calc(11px * var(--sp))"} style={{ flex: 1 }}>
            <Body size={10.5} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>When</Body>
            <Body size={13} bold style={{ marginTop: 3 }}>{ev.dateLong}</Body>
          </Card>
          <Card pad={"calc(11px * var(--sp))"} style={{ flex: 1 }}>
            <Body size={10.5} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Where</Body>
            <Body size={13} bold style={{ marginTop: 3 }}>{ev.venue} · {ev.courts} courts</Body>
          </Card>
        </Row>
        <Body size={13.5} dim>{ev.desc}</Body>
        <SecHead right={(ev.joined + (joined ? 1 : 0)) + "/" + ev.max}>Players</SecHead>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {joined && <Pill small on>TS You</Pill>}
          {ev.roster.map((r) => <Pill key={r} small>{names[r] || r}</Pill>)}
        </div>
        {ev.live && (
          <Card accent onClick={() => A.setTab("matches")}>
            <Row style={{ justifyContent: "space-between" }}>
              <Row gap={8}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", animation: "tpPulse 1.2s infinite" }}></span>
                <Body size={13.5} bold>Live now — Round 3 of 7</Body>
              </Row>
              <Body size={13} bold color="var(--accent-text)">Watch →</Body>
            </Row>
          </Card>
        )}
        {!joined && !ev.full && <Btn primary full onClick={() => A.openPay(ev.id)}>Join — {rupiah(ev.fee)}</Btn>}
        {!joined && ev.full && <Btn full ghost onClick={() => A.toast("Added to waitlist — we'll WhatsApp you")}>Event full — join waitlist</Btn>}
        {joined && <Btn full ghost onClick={() => A.toast("See you on court! 🎾")}>✓ You're in — view schedule</Btn>}
      </Col>
    </Col>
  );
}

function PaySheet({ S, A }) {
  const ev = S.events.find((e) => e.id === S.paying);
  const [method, setMethod] = React.useState("QRIS");
  const [state, setState] = React.useState("pick"); // pick → scanning → done
  React.useEffect(() => { setState("pick"); setMethod("QRIS"); }, [S.paying]);
  if (!ev) return null;
  const methods = ["QRIS", "GoPay", "OVO", "Dana", "Transfer"];
  return (
    <Sheet open={!!S.paying} onClose={() => A.closePay()} title={state === "done" ? "" : "Payment"}>
      {state === "pick" && (
        <Col gap={12}>
          <Card pad={12}>
            <Row style={{ justifyContent: "space-between" }}>
              <Body size={13.5} bold>{ev.title}</Body>
              <Num size={16}>{rupiah(ev.fee)}</Num>
            </Row>
            <Body size={12} dim style={{ marginTop: 2 }}>{ev.dateLong}</Body>
          </Card>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {methods.map((m) => <Pill key={m} on={method === m} onClick={() => setMethod(m)}>{m}</Pill>)}
          </div>
          <Btn primary full onClick={() => { setState("scanning"); setTimeout(() => setState("done"), 1400); }}>
            Pay {rupiah(ev.fee)} with {method}
          </Btn>
        </Col>
      )}
      {state === "scanning" && (
        <Col gap={14} style={{ alignItems: "center", padding: "10px 0 16px" }}>
          <div style={{
            width: 150, height: 150, borderRadius: 14, border: "1px solid var(--line)",
            background: "repeating-conic-gradient(var(--text) 0% 25%, var(--surface) 0% 50%) 0 0 / 16px 16px",
            opacity: 0.85,
          }}></div>
          <Body size={13} dim>Scan with your {method === "QRIS" ? "banking app" : method} · simulating…</Body>
        </Col>
      )}
      {state === "done" && (
        <Col gap={12} style={{ alignItems: "center", padding: "6px 0 10px", textAlign: "center" }}>
          <div style={{ width: 58, height: 58, borderRadius: "50%", background: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", animation: "tpPop .3s cubic-bezier(.2,1.4,.4,1)" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round"><path d="M5 13l5 5L20 7"></path></svg>
          </div>
          <Disp size={20}>You're in! 🎾</Disp>
          <Body size={13} dim>{ev.title} · {ev.dateLong}<br></br>Receipt sent to WhatsApp.</Body>
          <Btn primary full onClick={() => A.confirmJoin(ev.id)}>Done</Btn>
        </Col>
      )}
    </Sheet>
  );
}

Object.assign(window, { HomeScreen, EventsScreen, EventDetail, PaySheet, FeedItem });
