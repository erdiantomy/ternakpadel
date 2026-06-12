// Root app: state, actions, router, live simulation, tweaks, device shell.

const TP_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "device": "phone",
  "accent": "#FF6B00",
  "font": "inter",
  "density": "comfy",
  "homeLayout": "matchday"
}/*EDITMODE-END*/;

const TP_LS_KEY = "tp_proto_v1";

function tpLoad() {
  try { return JSON.parse(localStorage.getItem(TP_LS_KEY)) || {}; } catch (e) { return {}; }
}
function tpSave(patch) {
  try { localStorage.setItem(TP_LS_KEY, JSON.stringify({ ...tpLoad(), ...patch })); } catch (e) {}
}

function TernakApp() {
  const [t, setTweak] = useTweaks(TP_TWEAK_DEFAULTS);
  const saved = React.useMemo(tpLoad, []);

  const [tab, setTab] = React.useState("home");
  const [eventOpen, setEventOpen] = React.useState(null);
  const [paying, setPaying] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [scorer, setScorer] = React.useState(false);
  const [share, setShare] = React.useState(null);
  const [toastMsg, setToastMsg] = React.useState(null);
  const [onboarded, setOnboarded] = React.useState(!!saved.onboarded);

  const [joined, setJoined] = React.useState(saved.joined || {});
  const [checkedIn, setCheckedIn] = React.useState(false);
  const [feed, setFeed] = React.useState(() => TP_DATA.feed.map((p) => ({ ...p, liked: (saved.liked || []).includes(p.id) })));
  const [events, setEvents] = React.useState(TP_DATA.events.map((e) => ({ ...e, live: e.id === "fri-americano" })));
  const [timeline, setTimeline] = React.useState(TP_DATA.timeline);
  const [stats, setStats] = React.useState({ matches: 47, wins: 30, streak: 3, rank: 8, rankDelta: 0, myPts: 380 });
  const [live, setLive] = React.useState({
    round: 3,
    courts: [
      { id: "c1", teamA: "Bayu / Rina", teamB: "Eko / Maya", a: 16, b: 12 },
      { id: "c2", teamA: "Tomy / Dina", teamB: "Andre / Sari", a: 14, b: 10, yours: true },
      { id: "c3", teamA: "Dimas / Fitri", teamB: "Raka / Sari", a: 9, b: 11 },
    ],
  });
  const [standings, setStandings] = React.useState([
    { name: "Rina Wijaya", ini: "RW", pts: 86 },
    { name: "Tomy Santoso", ini: "TS", pts: 81, me: true },
    { name: "Bayu Nugroho", ini: "BN", pts: 77 },
    { name: "Dina Maharani", ini: "DM", pts: 74 },
    { name: "Andre Halim", ini: "AH", pts: 69 },
  ]);
  const [matchResult, setMatchResult] = React.useState(null);

  // live simulation tick (other courts creep up while watching)
  React.useEffect(() => {
    if ((tab !== "matches" && t.device !== "ipad") || scorer) return;
    const id = setInterval(() => {
      setLive((l) => ({
        ...l,
        courts: l.courts.map((c) => {
          if (c.yours || Math.random() < 0.5) return c;
          const key = Math.random() < 0.5 ? "a" : "b";
          return { ...c, [key]: c[key] + 1 };
        }),
      }));
    }, 2600);
    return () => clearInterval(id);
  }, [tab, scorer, t.device]);

  const winRate = Math.round((stats.wins / stats.matches) * 100);
  const players = React.useMemo(() => TP_DATA.players.map((p) => (p.me ? { ...p, pts: stats.myPts } : p)), [stats.myPts]);

  const toast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2200); };

  const A = {
    setTab: (x) => { setTab(x); setEventOpen(null); },
    openEvent: (id) => { setTab("events"); setEventOpen(id); },
    back: () => setEventOpen(null),
    openPay: (id) => setPaying(id),
    closePay: () => setPaying(null),
    confirmJoin: (id) => {
      const j = { ...joined, [id]: true };
      setJoined(j); setPaying(null); tpSave({ joined: j });
      toast("Joined ✓ — pairings drop 1h before start");
    },
    checkIn: () => { setCheckedIn(true); toast("Checked in — Court 2, Round 3 🎾"); },
    like: (id) => {
      setFeed((f) => {
        const nf = f.map((p) => (p.id === id ? { ...p, liked: !p.liked } : p));
        tpSave({ liked: nf.filter((p) => p.liked).map((p) => p.id) });
        return nf;
      });
    },
    setScorer,
    scoreCourt: (courtId, side, d) => {
      setLive((l) => ({
        ...l,
        courts: l.courts.map((c) => {
          if (c.id !== courtId) return c;
          const key = side === "A" ? "a" : "b";
          return { ...c, [key]: Math.max(0, c[key] + d) };
        }),
      }));
    },
    endRound: () => {
      setLive((l) => ({
        round: l.round + 1,
        courts: [
          { id: "c1", teamA: "Rina / Andre", teamB: "Tomy / Eko", a: 0, b: 0, yours: true },
          { id: "c2", teamA: "Dina / Bayu", teamB: "Maya / Dimas", a: 0, b: 0 },
          { id: "c3", teamA: "Sari / Raka", teamB: "Fitri / Walk-in", a: 0, b: 0 },
        ],
      }));
      setStandings((s) => s.map((p) => ({ ...p, pts: p.pts + Math.floor(Math.random() * 8) + (p.me ? 6 : 0) })).sort((a, b) => b.pts - a.pts));
      toast("Round complete — new pairings sent to every phone \ud83d\udce3");
    },
    score: (side, d) => {
      setLive((l) => ({
        ...l,
        courts: l.courts.map((c) => {
          if (!c.yours) return c;
          const key = side === "A" ? "a" : "b";
          return { ...c, [key]: Math.max(0, c[key] + d) };
        }),
      }));
    },
    endMatch: () => {
      const c = live.courts.find((x) => x.yours);
      const won = c.a > c.b;
      const prevRank = stats.rank;
      const next = {
        matches: stats.matches + 1,
        wins: stats.wins + (won ? 1 : 0),
        streak: won ? stats.streak + 1 : 0,
        rank: won && stats.rank === 8 ? 7 : stats.rank,
        rankDelta: won && stats.rank === 8 ? 1 : stats.rankDelta,
        myPts: stats.myPts + (won ? 19 : 2),
      };
      setStats(next);
      setMatchResult({ won, a: c.a, b: c.b, prevRank });
      const score = c.a + "–" + c.b;
      setTimeline((tl) => [
        ...(won && next.rank < prevRank ? [{ id: "tl-rank-" + Date.now(), kind: "rank", title: "Moved up to Rank #" + next.rank, sub: "Season 3 · just now", pts: "↑1" }] : []),
        { id: "tl-" + Date.now(), kind: won ? "W" : "L", title: (won ? "Won " : "Lost ") + score + " vs Andre / Sari", sub: "Friday Night Americano · just now", pts: won ? "+12" : "+2" },
        ...tl,
      ]);
      setFeed((f) => [
        { id: "f-" + Date.now(), who: "Tomy Santoso", ini: "TS", time: "now", kind: "result", text: won ? "defeated Andre / Sari" : "fell to Andre / Sari", score, sub: "Friday Night Americano · " + (won ? "+12" : "+2") + " pts", likes: 0, comments: 0 },
        ...f,
      ]);
      setStandings((s) => s.map((p) => (p.me ? { ...p, pts: p.pts + (won ? 12 : 2) } : p)).sort((a, b) => b.pts - a.pts));
    },
    closeScorer: () => {
      setScorer(false); setMatchResult(null);
      setLive((l) => ({ ...l, round: l.round + 1, courts: l.courts.map((c) => (c.yours ? { ...c, a: 0, b: 0, teamA: "Tomy / Rina", teamB: "Bayu / Maya" } : c)) }));
    },
    openShare: (kind) => setShare(kind),
    closeShare: () => setShare(null),
    setCreating,
    createEvent: (name, format, courts, max) => {
      setEvents((evs) => [...evs, {
        id: "ev-" + Date.now(), title: name, type: format, day: "SEN", date: "16",
        dateLong: "Senin, 16 Juni · 19:00", venue: "Padel Pro SCBD", courts, fee: 100000,
        pts: 10, max, joined: 1, desc: "Created by you. Smart matchmaking will balance pairings as players register.",
        roster: [],
      }]);
      setCreating(false); setTab("events");
      toast("Event created — registration open 📣");
    },
    finishOnboarding: () => { setOnboarded(true); tpSave({ onboarded: true }); },
    toast,
  };

  const S = { ...stats, winRate, joined, checkedIn, feed, events, timeline, live, standings, scorer, share, paying, creating, matchResult, players, rankHistory: TP_DATA.rankHistory.slice(0, 11).concat([stats.rank]), badgesGot: 3 + (stats.streak >= 10 ? 1 : 0) };

  const ev = events.find((e) => e.id === eventOpen);
  const dark = t.theme === "dark";
  const isPad = t.device === "ipad";

  // scale device to viewport
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const dw = isPad ? 1194 + 32 : 402, dh = isPad ? 834 + 32 : 874;
    const fit = () => setScale(Math.min(1, (window.innerHeight - 56) / dh, (window.innerWidth - 48) / dw));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [isPad]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", gap: 14, alignItems: "center", justifyContent: "center",
      background: dark ? "#0c0c0d" : "#e8e6e1", transition: "background .3s",
    }}>
      <div style={{ display: "flex", background: dark ? "#1c1c1e" : "#fff", borderRadius: 999, padding: 4, gap: 3, boxShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>
        {[["phone", "\ud83d\udcf1 Player app"], ["ipad", "\u25ad iPad host console"]].map(([id, label]) => (
          <button key={id} onClick={() => setTweak("device", id)} style={{
            border: "none", borderRadius: 999, padding: "7px 16px", cursor: "pointer",
            fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 600,
            background: t.device === id ? t.accent : "transparent",
            color: t.device === id ? "#0a0a0a" : dark ? "#a3a3a3" : "#6f6a62",
          }}>{label}</button>
        ))}
      </div>
      <div style={{ transform: "scale(" + scale + ")", transformOrigin: "center top" }}>
        {isPad ? (
          <IPadFrame dark={dark}>
            <HostConsole S={S} A={A} t={t}></HostConsole>
          </IPadFrame>
        ) : (
        <IOSDevice dark={dark}>
          <div style={{ ...tpTheme(t), background: "var(--bg)", height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
            <div style={{ height: 54, flex: "0 0 54px" }}></div>
            <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
              {tab === "home" && <HomeScreen S={S} A={A} layout={t.homeLayout}></HomeScreen>}
              {tab === "events" && !ev && <EventsScreen S={S} A={A}></EventsScreen>}
              {tab === "events" && ev && <EventDetail S={S} A={A} ev={ev}></EventDetail>}
              {tab === "matches" && <MatchesScreen S={S} A={A}></MatchesScreen>}
              {tab === "rankings" && <RankingsScreen S={S}></RankingsScreen>}
              {tab === "profile" && <ProfileScreen S={S} A={A}></ProfileScreen>}
            </div>
            <TabBar tab={tab} setTab={A.setTab} onFab={() => setCreating(true)}></TabBar>
            <div style={{ height: 22, flex: "0 0 22px", background: "var(--bg)" }}></div>
            <PaySheet S={S} A={A}></PaySheet>
            <CreateSheet S={S} A={A}></CreateSheet>
            <ScorerOverlay S={S} A={A}></ScorerOverlay>
            <ShareOverlay S={S} A={A}></ShareOverlay>
            {!onboarded && <Onboarding A={A}></Onboarding>}
            <Toast msg={toastMsg}></Toast>
          </div>
        </IOSDevice>
        )}
      </div>

      <TweaksPanel>
        <TweakSection label="Theme"></TweakSection>
        <TweakRadio label="Mode" value={t.theme} options={["dark", "light"]} onChange={(v) => setTweak("theme", v)}></TweakRadio>
        <TweakColor label="Accent" value={t.accent} options={["#FF6B00", "#C4F22E", "#2EAEFF", "#FF3D71"]} onChange={(v) => setTweak("accent", v)}></TweakColor>
        <TweakSection label="Typography"></TweakSection>
        <TweakSelect label="Type pairing" value={t.font} options={Object.keys(TP_FONTS).map((k) => ({ value: k, label: TP_FONTS[k].label }))} onChange={(v) => setTweak("font", v)}></TweakSelect>
        <TweakSection label="Layout"></TweakSection>
        <TweakRadio label="Device" value={t.device} options={[{ value: "phone", label: "Phone" }, { value: "ipad", label: "iPad host" }]} onChange={(v) => setTweak("device", v)}></TweakRadio>
        <TweakRadio label="Home order" value={t.homeLayout} options={["matchday", "feed"]} onChange={(v) => setTweak("homeLayout", v)}></TweakRadio>
        <TweakRadio label="Density" value={t.density} options={["comfy", "compact"]} onChange={(v) => setTweak("density", v)}></TweakRadio>
        <TweakSection label="Demo"></TweakSection>
        <TweakButton label="Replay onboarding" onClick={() => { setOnboarded(false); }}></TweakButton>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<TernakApp></TernakApp>);
