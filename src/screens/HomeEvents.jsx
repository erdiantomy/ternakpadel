import React from "react";
import { rupiah } from "../lib/format.js";
import { Disp, Body, Num, Card, Ava, Pill, Btn, Row, Col, SecHead, Sheet } from "../components/atoms.jsx";

export function FeedItem({ post, onLike }) {
  const kindIcon = { result: "🎾", rank: "📈", badge: "🏅", join: "📅", announcement: "📣" }[post.kind] || "🎾";
  return (
    <Card>
      <Row>
        <Ava ini={post.ini} d={34} />
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
            <path d="M12 21s-7.5-4.7-9.7-9A5.6 5.6 0 0 1 12 6.6 5.6 5.6 0 0 1 21.7 12c-2.2 4.3-9.7 9-9.7 9Z" />
          </svg>
          <Body size={12} bold dim={!post.liked} color={post.liked ? "var(--accent-text)" : undefined}>{post.likes + (post.liked ? 1 : 0)}</Body>
        </Row>
        <Row gap={5}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" /></svg>
          <Body size={12} dim>{post.comments}</Body>
        </Row>
        <Row gap={5} style={{ marginLeft: "auto" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13m0-13L8 7m4-4 4 4" /></svg>
        </Row>
      </Row>
    </Card>
  );
}

function MatchDayHero({ ev, joined, onOpen, onCheckin, checkedIn }) {
  return (
    <Card accent onClick={onOpen} style={{ position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: -30, top: -30, width: 130, height: 130, borderRadius: "50%", background: "var(--accent-soft)" }} />
      <Col gap={8} style={{ position: "relative" }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Body size={11.5} bold color="var(--accent-text)" style={{ letterSpacing: "0.08em" }}>{ev.today ? "TODAY" : ev.day} · {ev.time || "19:00"}</Body>
          <Body size={11.5} dim>{ev.joined + (joined ? 1 : 0)}/{ev.max} players</Body>
        </Row>
        <Disp size={22}>{ev.title}</Disp>
        <Body size={13} dim>{ev.venue} · {ev.courts} courts · +{ev.pts} pts</Body>
        <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
          <Row gap={0}>
            {(ev.avatars || ["RW", "BN", "SK", "AH"]).slice(0, 4).map((i, n) => (
              <div key={i + n} style={{ marginLeft: n ? -10 : 0 }}><Ava ini={i} d={28} /></div>
            ))}
            <Body size={12} dim style={{ marginLeft: 7 }}>+{Math.max(0, ev.joined - 4 + (joined ? 1 : 0))}</Body>
          </Row>
          {joined
            ? <Btn small primary={!checkedIn} ghost={checkedIn} onClick={(e) => { e.stopPropagation(); onCheckin(); }}>{checkedIn ? "✓ Checked in" : "Check in"}</Btn>
            : <Btn small primary onClick={(e) => { e.stopPropagation(); onOpen(); }}>Join · {rupiah(ev.fee)}</Btn>}
        </Row>
      </Col>
    </Card>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi,";
  if (h < 15) return "Selamat siang,";
  if (h < 18) return "Selamat sore,";
  return "Selamat malam,";
}

export function HomeScreen({ S, A, layout }) {
  const ev = S.events[0];
  const hero = ev ? (
    <MatchDayHero ev={ev} joined={S.joined[ev.id]} checkedIn={S.checkedIn}
      onOpen={() => A.openEvent(ev.id)} onCheckin={A.checkIn} />
  ) : null;
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
      {S.feed.map((p) => <FeedItem key={p.id} post={p} onLike={A.like} />)}
    </Col>
  );
  return (
    <Col gap={12} style={{ padding: "calc(14px * var(--sp)) 16px 90px" }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Col gap={1}>
          <Body size={12.5} dim>{greeting()}</Body>
          <Disp size={21}>{(S.me?.name || "Player").split(" ")[0]} 👋</Disp>
        </Col>
        <Row gap={8}>
          <button onClick={A.openSettings} title="Settings" style={{
            width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--line)",
            background: "var(--surface)", color: "var(--text2)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.98 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.98a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.23.55.78.94 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.97Z" />
            </svg>
          </button>
          <div style={{ position: "relative" }}>
            <Ava ini={S.me?.initials || "P"} d={36} ring />
            <div style={{ position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: "50%", background: "var(--accent)" }} />
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

export function EventsScreen({ S, A }) {
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
                    <div style={{ width: Math.round(((e.joined + (S.joined[e.id] ? 1 : 0)) / e.max) * 100) + "%", height: "100%", background: e.full ? "var(--danger)" : "var(--accent)" }} />
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

const ROSTER_NAMES = { rina: "Rina", eko: "Eko", maya: "Maya", dimas: "Dimas", fitri: "Fitri", bayu: "Bayu", sari: "Sari", andre: "Andre", dina: "Dina", raka: "Raka" };

export function EventDetail({ S, A, ev }) {
  const joined = S.joined[ev.id];
  const status = ev.myStatus || (joined ? "paid" : "none"); // none|requested|approved|paid|rejected
  return (
    <Col gap={12} style={{ padding: "0 0 90px" }}>
      <div style={{
        height: 130, background: "linear-gradient(135deg, var(--accent-soft), var(--surface2) 70%)",
        display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "12px 16px 14px",
      }}>
        <Row style={{ justifyContent: "space-between" }}>
          <button onClick={A.back} style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 999, padding: "6px 13px", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Back</button>
          <button onClick={() => A.shareEvent(ev.id)} style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 999, padding: "6px 13px", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🔗 Share</button>
        </Row>
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
        <SecHead right={(ev.participants?.length ?? ev.joined) + "/" + ev.max}>Players</SecHead>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {(ev.participants || []).map((p) => (
            <Row key={p.id} gap={7} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, padding: "4px 12px 4px 4px" }}>
              <Ava ini={p.initials} d={26} />
              <Body size={12.5} bold>{p.name.split(" ")[0]}{p.me ? " (You)" : ""}</Body>
            </Row>
          ))}
          {(!ev.participants || ev.participants.length === 0) && <Body size={12.5} dim>No participants yet — be the first in.</Body>}
        </div>

        {ev.canManage && (ev.requests?.length > 0) && (
          <Col gap={8}>
            <SecHead right={ev.requests.length + " pending"}>Join requests</SecHead>
            {ev.requests.map((r) => (
              <Card key={r.id} pad={10}>
                <Row style={{ justifyContent: "space-between" }} gap={8}>
                  <Row gap={9} style={{ minWidth: 0 }}>
                    <Ava ini={r.initials} d={30} />
                    <Body size={13.5} bold style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</Body>
                  </Row>
                  <Row gap={7}>
                    <Btn small ghost onClick={() => A.rejectJoin(ev.id, r.id)}>Decline</Btn>
                    <Btn small primary onClick={() => A.approveJoin(ev.id, r.id)}>Approve</Btn>
                  </Row>
                </Row>
              </Card>
            ))}
          </Col>
        )}

        {ev.live && (
          <Card accent onClick={() => A.setTab("matches")}>
            <Row style={{ justifyContent: "space-between" }}>
              <Row gap={8}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", animation: "tpPulse 1.2s infinite" }} />
                <Body size={13.5} bold>Live now — Round {S.live?.round || 3} of {S.live?.totalRounds || 7}</Body>
              </Row>
              <Body size={13} bold color="var(--accent-text)">Watch →</Body>
            </Row>
          </Card>
        )}

        {ev.canManage && (
          <Btn primary full onClick={() => A.manageSession(ev.id)}>⚙ Manage session — generate, score, edit</Btn>
        )}
        {ev.canManage && (
          <Btn full ghost onClick={() => A.shareLeaderboard(ev.id)}>📊 Share live leaderboard</Btn>
        )}

        {status === "none" && !ev.full && <Btn primary full onClick={() => A.requestJoin(ev.id)}>Request to join</Btn>}
        {status === "none" && ev.full && <Btn full ghost onClick={() => A.toast("Event full — we'll WhatsApp you if a spot opens")}>Event full</Btn>}
        {status === "requested" && <Btn full ghost onClick={() => A.toast("Waiting for the host to approve your request")}>⏳ Waiting for host approval</Btn>}
        {status === "approved" && <Btn primary full onClick={() => A.openPay(ev.id)}>Approved — Pay {rupiah(ev.fee)}</Btn>}
        {status === "paid" && <Btn full ghost onClick={() => A.toast("See you on court! 🎾")}>✓ You're in — view schedule</Btn>}
        {status === "rejected" && <Btn full ghost onClick={() => A.toast("Your request wasn't approved this time")}>Request not approved</Btn>}
      </Col>
    </Col>
  );
}

export function PaySheet({ S, A }) {
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
          }} />
          <Body size={13} dim>Scan with your {method === "QRIS" ? "banking app" : method} · simulating…</Body>
        </Col>
      )}
      {state === "done" && (
        <Col gap={12} style={{ alignItems: "center", padding: "6px 0 10px", textAlign: "center" }}>
          <div style={{ width: 58, height: 58, borderRadius: "50%", background: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", animation: "tpPop .3s cubic-bezier(.2,1.4,.4,1)" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round"><path d="M5 13l5 5L20 7" /></svg>
          </div>
          <Disp size={20}>You're in! 🎾</Disp>
          <Body size={13} dim>{ev.title} · {ev.dateLong}<br />Receipt sent to WhatsApp.</Body>
          <Btn primary full onClick={() => A.confirmJoin(ev.id)}>Done</Btn>
        </Col>
      )}
    </Sheet>
  );
}
