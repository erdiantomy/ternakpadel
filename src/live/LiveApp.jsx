import React from "react";
import { supabase } from "../lib/supabase.js";
import { tpTheme } from "../theme.js";
import { TabBar, Toast, Body } from "../components/atoms.jsx";
import { SettingsSheet } from "../components/SettingsSheet.jsx";
import { HomeScreen, EventsScreen, EventDetail } from "../screens/HomeEvents.jsx";
import { MatchesScreen, ScorerOverlay, RankingsScreen } from "../screens/LiveRank.jsx";
import { ProfileScreen, ShareOverlay, CreateSheet } from "../screens/Profile.jsx";
import { HostConsole } from "../screens/Host.jsx";
import { LiveOnboarding } from "./LiveOnboarding.jsx";
import { CourtBadge } from "../components/BrandMark.jsx";
import { VENUE_DEFAULT } from "../lib/courts.js";

// ---------- helpers ----------

const DAYS_ID = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];
const initialsOf = (name) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";
const firstName = (name) => (name || "Player").trim().split(/\s+/)[0];

function fmtEventDates(startsAt, endsAt) {
  const d = new Date(startsAt);
  const t = (x) => new Date(x).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");
  const long = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })
    + " · " + t(d) + (endsAt ? "–" + t(endsAt) : "");
  const today = new Date().toDateString() === d.toDateString();
  return { day: DAYS_ID[d.getDay()], date: String(d.getDate()), dateLong: long, time: t(d), today };
}

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "now";
  if (s < 3600) return Math.round(s / 60) + "m";
  if (s < 86400) return Math.round(s / 3600) + "h";
  return Math.round(s / 86400) + "d";
}

const SETTINGS_DEFAULTS = { theme: "dark", accent: "#C4F22E", font: "brand", density: "comfy", homeLayout: "matchday" };
const LS_KEY = "tp_live_settings";

// americano pairing: rank by event standings, groups of 4 → (1&4) vs (2&3)
function nextPairings(standings, profilesById) {
  const ids = standings.map((s) => s.player_id);
  const courts = [];
  for (let i = 0; i + 3 < ids.length; i += 4) {
    const g = ids.slice(i, i + 4);
    courts.push({ team_a: [g[0], g[3]], team_b: [g[1], g[2]] });
  }
  const resting = ids.slice(courts.length * 4);
  const nameOf = (id) => firstName(profilesById[id]?.full_name);
  return {
    courts: courts.map((c) => ({
      ...c,
      team_a_names: c.team_a.map(nameOf).join(" / "),
      team_b_names: c.team_b.map(nameOf).join(" / "),
    })),
    resting: resting.map(nameOf),
  };
}

// ---------- root ----------

export default function LiveApp() {
  const [t, setT_] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      if (saved.accent === "#FF6B00") delete saved.accent; // migrate off the old default accent
      return { ...SETTINGS_DEFAULTS, ...saved };
    }
    catch { return SETTINGS_DEFAULTS; }
  });
  const setT = (k, v) => setT_((prev) => {
    const next = { ...prev, [k]: v };
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  const [session, setSession] = React.useState(undefined); // undefined = loading
  const [mode, setMode] = React.useState("player");
  const [tab, setTab] = React.useState("home");
  const [eventOpen, setEventOpen] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [scorer, setScorer] = React.useState(false);
  const [share, setShare] = React.useState(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState(null);
  const [payBusy, setPayBusy] = React.useState(false);
  const [matchResult, setMatchResult] = React.useState(null);
  const [onboardingDone, setOnboardingDone] = React.useState(false);

  const [db, setDb] = React.useState({
    profile: null, profiles: [], events: [], eventPlayers: [], posts: [], likes: [],
    points: [], rankHistory: [], badgeCatalog: [], myBadges: [], matches: [], seasons: [],
  });

  const toastTimer = React.useRef(null);
  const toast = React.useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }, []);

  // ---------- auth ----------
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---------- data ----------
  const refresh = React.useCallback(async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    const [
      { data: profile }, { data: profiles }, { data: events }, { data: eventPlayers },
      { data: posts }, { data: likes }, { data: points }, { data: rankHistory },
      { data: badgeCatalog }, { data: myBadges }, { data: matches }, { data: seasons },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase.from("profiles_public").select("id,full_name,username,is_host"),
      supabase.from("events").select("*").neq("status", "cancelled").order("starts_at"),
      supabase.from("event_players").select("*"),
      supabase.from("feed_posts").select("*").order("created_at", { ascending: false }).limit(40),
      supabase.from("feed_likes").select("*"),
      supabase.from("player_points").select("*"),
      supabase.from("rank_history").select("*").eq("player_id", uid).order("recorded_at"),
      supabase.from("badges").select("*").order("sort"),
      supabase.from("player_badges").select("*").eq("player_id", uid),
      supabase.from("matches").select("*").order("court"),
      supabase.from("seasons").select("*").order("id", { ascending: false }),
    ]);
    setDb({
      profile, profiles: profiles || [], events: events || [], eventPlayers: eventPlayers || [],
      posts: posts || [], likes: likes || [], points: points || [], rankHistory: rankHistory || [],
      badgeCatalog: badgeCatalog || [], myBadges: myBadges || [], matches: matches || [],
      seasons: seasons || [],
    });
  }, []);

  React.useEffect(() => { if (session) refresh(); }, [session, refresh]);

  // realtime: matches / rosters / feed changes push a debounced refresh
  React.useEffect(() => {
    if (!session) return;
    let timer = null;
    const soon = () => { clearTimeout(timer); timer = setTimeout(refresh, 350); };
    const ch = supabase.channel("app-live");
    for (const table of ["matches", "event_players", "feed_posts", "feed_likes", "payments"]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table }, soon);
    }
    ch.subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(ch); };
  }, [session, refresh]);

  // returning from Xendit: ?paid=<event_id>
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid")) {
      const eventId = params.get("paid");
      toast("Memverifikasi pembayaran…");
      setTab("events"); setEventOpen(eventId);
      window.history.replaceState({}, "", window.location.pathname);
      let tries = 0;
      const poll = setInterval(async () => {
        tries++;
        try {
          const { data } = await supabase.functions.invoke("check-payment", { body: { event_id: eventId } });
          if (data?.status === "paid") {
            toast("Pembayaran berhasil — kamu masuk! 🎾");
            clearInterval(poll);
            refresh();
            return;
          }
          if (data?.status === "expired") {
            toast("Invoice kadaluarsa — silakan bayar ulang");
            clearInterval(poll);
            return;
          }
        } catch (_) { /* ignore, akan retry */ }
        refresh();
        if (tries >= 8) {
          clearInterval(poll);
          toast("Status pembayaran belum terkonfirmasi, cek kembali nanti");
        }
      }, 2500);
      return () => clearInterval(poll);
    }
    if (params.get("payfail")) {
      toast("Payment not completed — try again");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- derive the S contract the screens expect ----------
  const uid = session?.user?.id;
  const S = React.useMemo(() => {
    const profilesById = Object.fromEntries(db.profiles.map((p) => [p.id, p]));
    const season = db.seasons.find((s) => s.is_current) || db.seasons[0];

    const sortedPoints = db.points
      .filter((p) => !season || p.season_id === season.id)
      .sort((a, b) => b.pts - a.pts);
    const players = sortedPoints.map((p) => ({
      id: p.player_id,
      name: profilesById[p.player_id]?.full_name || "Player",
      initials: initialsOf(profilesById[p.player_id]?.full_name),
      pts: p.pts,
      me: p.player_id === uid,
    }));
    const myIdx = sortedPoints.findIndex((p) => p.player_id === uid);
    const mine = myIdx >= 0 ? sortedPoints[myIdx] : { pts: 0, matches: 0, wins: 0, streak: 0 };
    const rank = myIdx >= 0 ? myIdx + 1 : players.length + 1;
    const ranks = db.rankHistory.map((r) => r.rank);
    const rankDelta = ranks.length >= 2 ? Math.max(0, ranks[ranks.length - 2] - ranks[ranks.length - 1]) : 0;

    const paidByEvent = {};     // status==='paid' → participants
    const requestsByEvent = {}; // status==='requested' → awaiting host/admin
    const myEpByEvent = {};     // the current user's row per event
    for (const ep of db.eventPlayers) {
      const isPaid = ep.paid || ep.status === "paid";
      if (isPaid) (paidByEvent[ep.event_id] = paidByEvent[ep.event_id] || []).push(ep);
      else if (ep.status === "requested") (requestsByEvent[ep.event_id] = requestsByEvent[ep.event_id] || []).push(ep);
      if (ep.player_id === uid) myEpByEvent[ep.event_id] = ep;
    }
    const joined = {};
    for (const id in myEpByEvent) if (myEpByEvent[id].paid || myEpByEvent[id].status === "paid") joined[id] = true;
    const personOf = (id) => ({ id, name: profilesById[id]?.full_name || "Player", initials: initialsOf(profilesById[id]?.full_name), me: id === uid });
    const canManageEvent = (e) => !!uid && (e.created_by === uid || db.profile?.is_host || db.profile?.is_admin);

    const events = db.events
      .filter((e) => e.status !== "done")
      .map((e) => {
        const roster = (paidByEvent[e.id] || []).map((ep) => profilesById[ep.player_id]).filter(Boolean);
        const dd = fmtEventDates(e.starts_at, e.ends_at);
        return {
          id: e.id, title: e.title, type: e.type, venue: e.venue, courts: e.courts,
          fee: e.fee, pts: e.pts, max: e.max_players, desc: e.description,
          joined: roster.length, full: roster.length >= e.max_players,
          live: e.status === "live", createdBy: e.created_by,
          roster: roster.filter((p) => p.id !== uid).map((p) => firstName(p.full_name)),
          avatars: roster.map((p) => initialsOf(p.full_name)),
          // join-approval flow
          myStatus: myEpByEvent[e.id]?.status || (joined[e.id] ? "paid" : "none"),
          participants: (paidByEvent[e.id] || []).map((ep) => personOf(ep.player_id)),
          requests: (requestsByEvent[e.id] || []).map((ep) => personOf(ep.player_id)),
          canManage: canManageEvent(e),
          ...dd,
          today: dd.today || e.status === "live",
        };
      })
      .sort((a, b) => (b.live - a.live) || (b.today - a.today) || 0);

    const liveEvent = db.events.find((e) => e.status === "live");
    let live = null;
    let standings = [];
    if (liveEvent) {
      const evMatches = db.matches.filter((m) => m.event_id === liveEvent.id);
      const round = Math.max(1, ...evMatches.map((m) => m.round));
      const courts = evMatches
        .filter((m) => m.round === round && m.status === "live")
        .sort((a, b) => a.court - b.court)
        .map((m) => ({
          id: m.id, court: m.court, teamA: m.team_a_names, teamB: m.team_b_names,
          a: m.score_a, b: m.score_b, target: m.target,
          yours: !!uid && (m.team_a.includes(uid) || m.team_b.includes(uid)),
          mySide: uid && m.team_a.includes(uid) ? "A" : "B",
        }));
      // standings = sum of your team's score across the event's matches
      const acc = {};
      for (const m of evMatches) {
        for (const pid of m.team_a) acc[pid] = (acc[pid] || 0) + m.score_a;
        for (const pid of m.team_b) acc[pid] = (acc[pid] || 0) + m.score_b;
      }
      const standRows = Object.entries(acc)
        .map(([player_id, pts]) => ({ player_id, pts }))
        .sort((a, b) => b.pts - a.pts);
      standings = standRows.slice(0, 8).map((r) => ({
        name: profilesById[r.player_id]?.full_name || "Player",
        ini: initialsOf(profilesById[r.player_id]?.full_name),
        pts: r.pts, me: r.player_id === uid,
      }));
      const roster = (paidByEvent[liveEvent.id] || []);
      const onCourt = new Set(evMatches.filter((m) => m.round === round && m.status === "live")
        .flatMap((m) => [...m.team_a, ...m.team_b]));
      const restingNames = roster.filter((ep) => !onCourt.has(ep.player_id))
        .map((ep) => firstName(profilesById[ep.player_id]?.full_name));
      const pairing = nextPairings(standRows, profilesById);
      live = {
        eventId: liveEvent.id, title: liveEvent.title, venue: liveEvent.venue,
        round, totalRounds: 7, courts,
        nextPairs: pairing.courts.length
          ? pairing.courts.map((c) => [c.team_a_names, c.team_b_names]) : undefined,
        resting: restingNames.length ? restingNames.join(", ") : null,
        checkedIn: roster.filter((ep) => ep.checked_in).length,
        totalPlayers: roster.length,
        _pairing: pairing,
      };
    }

    const likesByPost = {};
    for (const l of db.likes) (likesByPost[l.post_id] = likesByPost[l.post_id] || []).push(l.player_id);
    const feed = db.posts.map((p) => ({
      id: p.id, who: profilesById[p.author]?.full_name || "Player",
      ini: initialsOf(profilesById[p.author]?.full_name), time: timeAgo(p.created_at),
      kind: p.kind, text: p.text, score: p.score, sub: p.sub,
      likes: (likesByPost[p.id] || []).filter((x) => x !== uid).length,
      liked: (likesByPost[p.id] || []).includes(uid),
      comments: 0,
    }));

    const fmtSub = (iso, title) => title + " · " + new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    const eventTitleById = Object.fromEntries(db.events.map((e) => [e.id, e]));
    const timeline = [
      ...db.matches.filter((m) => m.status === "done" && uid && (m.team_a.includes(uid) || m.team_b.includes(uid)))
        .map((m) => {
          const inA = m.team_a.includes(uid);
          const won = inA ? m.score_a >= m.score_b : m.score_b > m.score_a;
          const opp = inA ? m.team_b_names : m.team_a_names;
          const ev = eventTitleById[m.event_id];
          return {
            id: "m-" + m.id, at: m.finished_at || m.created_at, kind: won ? "W" : "L",
            title: (won ? "Won " : "Lost ") + Math.max(m.score_a, m.score_b) + "–" + Math.min(m.score_a, m.score_b) + " vs " + opp,
            sub: fmtSub(m.finished_at || m.created_at, ev?.title || "Match"),
            pts: won ? "+" + ((ev?.pts ?? 10) + 2) : "+2",
          };
        }),
      ...db.myBadges.map((b) => ({
        id: "b-" + b.badge_id, at: b.earned_at, kind: "badge",
        title: "Earned '" + (db.badgeCatalog.find((c) => c.id === b.badge_id)?.name || b.badge_id) + "'",
        sub: fmtSub(b.earned_at, "Badge"), pts: "",
      })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 15);

    const myBadgeIds = new Set(db.myBadges.map((b) => b.badge_id));
    const badges = db.badgeCatalog.map((b) => ({ ...b, got: myBadgeIds.has(b.id) }));

    const me = db.profile ? {
      name: db.profile.full_name || "Player",
      user: db.profile.username || "@player",
      initials: initialsOf(db.profile.full_name),
      skill: db.profile.skill, side: db.profile.side, city: db.profile.city,
      memberSince: new Date(db.profile.created_at).getFullYear(),
    } : null;

    const heroEv = events[0];
    const checkedIn = !!db.eventPlayers.find((ep) => ep.player_id === uid && heroEv && ep.event_id === heroEv.id && ep.checked_in);
    const rh = ranks.length >= 2 ? ranks.slice(-12) : [rank, rank];

    return {
      me, events, joined, feed, timeline, live, standings, players, badges,
      seasons: db.seasons.map((s) => ({ id: s.id, name: s.name, rank: "—", now: s.is_current })),
      matches: mine.matches, wins: mine.wins, streak: mine.streak, rank,
      rankDelta, myPts: mine.pts,
      winRate: mine.matches ? Math.round((mine.wins / mine.matches) * 100) : 0,
      rankHistory: rh, badgesGot: badges.filter((b) => b.got).length,
      checkedIn, scorer, share, creating, paying: payBusy, matchResult,
      shareLine: matchResult?.line, shareSub: matchResult?.sub,
      // only hosts/admins may create events & matches and approve requests
      isManager: !!(db.profile?.is_admin || db.profile?.is_host),
    };
  }, [db, uid, scorer, share, creating, payBusy, matchResult]);

  // ---------- actions ----------
  const A = React.useMemo(() => ({
    setTab: (x) => { setTab(x); setEventOpen(null); },
    openEvent: (id) => { setTab("events"); setEventOpen(id); },
    back: () => setEventOpen(null),
    toast,
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
    replayOnboarding: async () => { setSettingsOpen(false); await supabase.auth.signOut(); setOnboardingDone(false); },
    signOut: async () => { setSettingsOpen(false); await supabase.auth.signOut(); },

    // player asks to join → goes into the host's request queue
    requestJoin: async (eventId) => {
      if (!uid) return;
      const { error } = await supabase.from("event_players")
        .insert({ event_id: eventId, player_id: uid, status: "requested", paid: false });
      if (error) return toast(error.message);
      toast("Request sent — the host will review it ✋");
      refresh();
    },
    // host / admin decisions on a pending request
    approveJoin: async (eventId, playerId) => {
      const { error } = await supabase.from("event_players")
        .update({ status: "approved" }).eq("event_id", eventId).eq("player_id", playerId);
      if (error) return toast(error.message);
      toast("Approved — they can pay now ✓");
      refresh();
    },
    rejectJoin: async (eventId, playerId) => {
      const { error } = await supabase.from("event_players")
        .update({ status: "rejected" }).eq("event_id", eventId).eq("player_id", playerId);
      if (error) return toast(error.message);
      toast("Request declined");
      refresh();
    },

    openPay: async (eventId) => {
      setPayBusy(true);
      toast("Preparing payment…");
      const { data, error } = await supabase.functions.invoke("create-invoice", { body: { event_id: eventId } });
      setPayBusy(false);
      if (error || data?.error) return toast(data?.error || "Payment setup failed — try again");
      window.location.href = data.invoice_url;
    },
    closePay: () => setPayBusy(false),
    confirmJoin: () => {},

    checkIn: async () => {
      const ev = S.events[0];
      if (!ev) return;
      await supabase.from("event_players").update({ checked_in: true })
        .eq("event_id", ev.id).eq("player_id", uid);
      toast("Checked in 🎾");
      refresh();
    },

    like: async (postId) => {
      const liked = db.likes.some((l) => l.post_id === postId && l.player_id === uid);
      if (liked) await supabase.from("feed_likes").delete().eq("post_id", postId).eq("player_id", uid);
      else await supabase.from("feed_likes").insert({ post_id: postId, player_id: uid });
      refresh();
    },

    setScorer,
    score: async (side, d) => {
      const c = S.live?.courts.find((x) => x.yours);
      if (!c) return;
      const col = side === "A" ? "score_a" : "score_b";
      const val = Math.max(0, (side === "A" ? c.a : c.b) + d);
      setDb((prev) => ({ ...prev, matches: prev.matches.map((m) => m.id === c.id ? { ...m, [col]: val } : m) }));
      await supabase.from("matches").update({ [col]: val }).eq("id", c.id);
    },
    scoreCourt: async (matchId, side, d) => {
      const m = db.matches.find((x) => x.id === matchId);
      if (!m) return;
      const col = side === "A" ? "score_a" : "score_b";
      const val = Math.max(0, m[col] + d);
      setDb((prev) => ({ ...prev, matches: prev.matches.map((x) => x.id === matchId ? { ...x, [col]: val } : x) }));
      await supabase.from("matches").update({ [col]: val }).eq("id", matchId);
    },

    endMatch: async () => {
      const c = S.live?.courts.find((x) => x.yours);
      if (!c) return;
      const { data, error } = await supabase.rpc("finish_match", { p_match_id: c.id });
      if (error) return toast(error.message);
      const my = c.mySide === "A" ? c.teamA : c.teamB;
      const opp = c.mySide === "A" ? c.teamB : c.teamA;
      setMatchResult({
        won: data.won, a: Math.max(data.score_a, data.score_b), b: Math.min(data.score_a, data.score_b),
        prevRank: data.prev_rank ?? S.rank, pts: data.pts,
        line: data.won ? my + " def. " + opp : opp + " def. " + my,
        sub: (S.live?.title || "") + " · +" + data.pts + " pts",
      });
      refresh();
    },
    closeScorer: () => { setScorer(false); setMatchResult(null); },

    endRound: async () => {
      const live = S.live;
      if (!live) return;
      const pairing = live._pairing;
      await supabase.from("matches").update({ status: "done", finished_at: new Date().toISOString() })
        .eq("event_id", live.eventId).eq("round", live.round).eq("status", "live");
      if (pairing && pairing.courts.length) {
        await supabase.from("matches").insert(pairing.courts.map((c, i) => ({
          event_id: live.eventId, round: live.round + 1, court: i + 1,
          team_a: c.team_a, team_b: c.team_b,
          team_a_names: c.team_a_names, team_b_names: c.team_b_names,
        })));
      }
      toast("Round complete — new pairings sent to every phone 📣");
      refresh();
    },

    openShare: (kind) => setShare(kind),
    closeShare: () => setShare(null),
    setCreating,
    createEvent: async (name, format, courts, max, when) => {
      if (!(db.profile?.is_admin || db.profile?.is_host)) {
        return toast("Only hosts and admins can create events");
      }
      const startsAt = when ? new Date(when) : new Date(Date.now() + 86400000);
      const { error } = await supabase.from("events").insert({
        title: name, type: format, courts, max_players: max,
        starts_at: startsAt.toISOString(),
        venue: VENUE_DEFAULT, fee: 100000, pts: format === "League" ? 25 : 10,
        description: "Smart matchmaking will balance pairings as players register.",
        created_by: uid,
      });
      if (error) return toast(error.message);
      setCreating(false); setTab("events");
      toast("Event created — registration open 📣");
      refresh();
    },

    enterHost: () => {
      const isHost = db.profile?.is_admin || db.profile?.is_host;
      if (!isHost) { toast("Host access required — ask an admin"); return; }
      if (!S.live) { toast("No live event to host right now"); return; }
      setSettingsOpen(false); setMode("host");
    },
    exitHost: () => setMode("player"),
    finishOnboarding: () => setOnboardingDone(true),
  }), [S, db, uid, toast, refresh]);

  // ---------- render ----------
  const dark = t.theme === "dark";
  const theme = tpTheme(t);

  if (session === undefined) {
    return <div style={{ ...theme, height: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ animation: "tpPulse 1.2s infinite" }}><CourtBadge size={56} /></div>
    </div>;
  }

  const needsOnboarding = !session || (db.profile && !db.profile.full_name && !onboardingDone);

  if (mode === "host" && session) {
    return (
      <div style={{ ...theme, height: "100dvh", background: "var(--bg)", position: "relative", overflowX: "auto" }}>
        <HostConsole S={S} A={A} />
        <Toast msg={toastMsg} />
      </div>
    );
  }

  const ev = S.events.find((e) => e.id === eventOpen);

  return (
    <div style={{ minHeight: "100dvh", background: dark ? "#070B1C" : "#E5EAF7", display: "flex", justifyContent: "center", transition: "background .3s" }}>
      <div style={{
        ...theme, background: "var(--bg)", width: "100%", maxWidth: 480, height: "100dvh",
        display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
        boxShadow: "0 0 0 1px var(--line)",
      }}>
        <div style={{ height: "env(safe-area-inset-top)", flex: "0 0 auto" }} />
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {tab === "home" && <HomeScreen S={S} A={A} layout={t.homeLayout} />}
          {tab === "events" && !ev && <EventsScreen S={S} A={A} />}
          {tab === "events" && ev && <EventDetail S={S} A={A} ev={ev} />}
          {tab === "matches" && <MatchesScreen S={S} A={A} />}
          {tab === "rankings" && <RankingsScreen S={S} />}
          {tab === "profile" && <ProfileScreen S={S} A={A} />}
        </div>
        <TabBar tab={tab} setTab={A.setTab} onFab={S.isManager ? () => setCreating(true) : undefined} />
        <CreateSheet S={S} A={A} />
        <SettingsSheet open={settingsOpen} t={t} setT={setT} A={A} manager={S.isManager} />
        <ScorerOverlay S={S} A={A} />
        <ShareOverlay S={S} A={A} />
        {payBusy && (
          <div style={{ position: "absolute", inset: 0, zIndex: 95, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Body size={14} bold color="#fff" style={{ animation: "tpPulse 1.2s infinite" }}>Opening secure payment…</Body>
          </div>
        )}
        {needsOnboarding && (
          <LiveOnboarding session={session} profile={db.profile} toast={toast}
            onDone={() => { setOnboardingDone(true); refresh(); }} />
        )}
        <Toast msg={toastMsg} />
      </div>
    </div>
  );
}
