import React from "react";
import { supabase } from "../lib/supabase.js";
import { tpTheme } from "../theme.js";
import { CourtBadge } from "../components/BrandMark.jsx";
import { VENUE_DEFAULT, courtName } from "../lib/courts.js";

// Superadmin operations console — reachable at /admin.
// Gated on profiles.is_admin (see supabase/migrations/0002_admin.sql).
// Lets an admin see all payments, members, events, matches and content, and
// run the core operations: create/manage events, set status, post content,
// and grant host/admin.

const THEME = { theme: "dark", accent: "#C4F22E", font: "brand", density: "comfy" };
const idr = (n) => "Rp" + (n || 0).toLocaleString("id-ID");
const initials = (name) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";
const fmt = (iso, withTime = true) =>
  iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }) : "—";

const EVENT_TYPES = ["Americano", "Mexicano", "League", "King of the Hill", "Knockout", "Mixicano"];
const EVENT_STATUS = ["open", "live", "done", "cancelled"];
const PAY_COLORS = { paid: "#46d369", pending: "#e6a700", expired: "#888", failed: "#ff5c5c" };
// Demo Mode lets an admin run the whole flow by hand against real data (scores
// feed the real leaderboard). On by default; set VITE_DEMO_MODE="false" to hide.
const DEMO_ENABLED = import.meta.env.VITE_DEMO_MODE !== "false";

// Growth hack: paste any event caption (reclub / WhatsApp / IG) → pre-fill the
// create-event form. No API, no scraping — pure text parsing, admin reviews
// before saving. Returns only the fields it confidently found.
function parseFlyer(text) {
  const t = (text || "").replace(/ /g, " ");
  const lc = t.toLowerCase();
  const out = {};

  const courts = (lc.match(/(\d+)\s*c\b/) || lc.match(/(\d+)\s*courts?/) || [])[1];
  if (courts) out.courts = Math.min(8, +courts);

  const players = (lc.match(/(\d+)\s*(?:players?|pax)/) || [])[1];
  const pairs = (lc.match(/(\d+)\s*pair/) || [])[1];
  if (players) out.max = +players; else if (pairs) out.max = Math.min(64, +pairs * 2);

  const hours = (lc.match(/(\d+)\s*h\b/) || lc.match(/(\d+)\s*hours?/) || [])[1];

  const types = ["Mexicano", "Mixicano", "Americano", "King of the Hill", "Knockout", "League"];
  let type = types.find((ty) => lc.includes(ty.toLowerCase()));
  if (!type && lc.includes("koth")) type = "King of the Hill";
  if (!type && lc.includes("marathon")) type = "Americano";
  out.type = type || "Americano";

  const vm = t.match(/📍\s*([^\n📍⏰🏆🔥💸🏃]+)/);
  if (vm) { const v = vm[1].trim().replace(/\s+/g, " "); if (v) out.venue = /toms/i.test(v) ? "TOMS PADEL" : v; }

  const feeM = t.match(/fee[^\d]*(?:rp\s*)?([\d.,]{4,})/i);
  if (feeM) out.fee = parseInt(feeM[1].replace(/[.,]/g, ""), 10);
  const prize = (t.match(/(?:prize|cash)[^\d]*([\d.,]{5,})/i) || [])[1];

  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const dm = lc.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})/);
  const tm = lc.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)/);
  if (dm) {
    const now = new Date();
    let hh = 0, mm = 0;
    if (tm) { hh = (+tm[1] % 12) + (tm[3] === "pm" ? 12 : 0); mm = tm[2] ? +tm[2] : 0; }
    let d = new Date(now.getFullYear(), months[dm[1]], +dm[2], hh, mm);
    if (d.getTime() < now.getTime() - 36e5) d = new Date(now.getFullYear() + 1, months[dm[1]], +dm[2], hh, mm);
    const p = (n) => String(n).padStart(2, "0");
    out.when = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  let title = t
    .replace(/[^\x00-\x7F]+/g, " ")
    .replace(/\b\d+\s*[ch]\b/gi, " ")
    .replace(/\b\d+\s*pair\b/gi, " ")
    .replace(/win[^]*?prize[^]*?[\d.,]+/i, " ")
    .replace(/(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?[^]*$/i, " ")
    .replace(/[|!·*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  out.title = title.split(" ").slice(0, 7).join(" ") || "Padel Session";

  const bits = [];
  if (prize) bits.push("Prize Rp " + prize);
  if (hours) bits.push(hours + " hours");
  out.desc = bits.join(" · ");
  return out;
}

export default function AdminConsole() {
  const [session, setSession] = React.useState(undefined);
  const [me, setMe] = React.useState(undefined); // undefined=loading, null=none
  const [tab, setTab] = React.useState("overview");
  const [toastMsg, setToastMsg] = React.useState(null);
  const [payFilter, setPayFilter] = React.useState("all");
  const [payEvent, setPayEvent] = React.useState("all");
  const [paste, setPaste] = React.useState("");
  const [link, setLink] = React.useState("");
  const [rosterFor, setRosterFor] = React.useState(null); // event id whose placeholder roster is open
  const [rosterDraft, setRosterDraft] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [db, setDb] = React.useState({
    profiles: [], events: [], eventPlayers: [], payments: [], matches: [], posts: [], points: [],
  });
  const [form, setForm] = React.useState({
    title: "", type: "Americano", when: "", venue: VENUE_DEFAULT, fee: 100000, courts: 4, max: 16, desc: "",
    source: "", source_ref: "", source_url: "",
  });
  const [announce, setAnnounce] = React.useState("");
  // ---- demo mode state ----
  const [pForm, setPForm] = React.useState({ full_name: "", email: "", phone: "" });
  const [linkPick, setLinkPick] = React.useState("");
  const [linkEmail, setLinkEmail] = React.useState("");
  const [demoEvent, setDemoEvent] = React.useState("");
  const [dForm, setDForm] = React.useState({ title: "", type: "Americano" });
  const [rosterPick, setRosterPick] = React.useState("");
  const [mForm, setMForm] = React.useState({ a1: "", a2: "", b1: "", b2: "", court: 1 });

  const toast = React.useCallback((m) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 3000); }, []);

  // ---- auth ----
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  React.useEffect(() => {
    if (session === undefined) return;
    if (!session) { setMe(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).single()
      .then(({ data }) => setMe(data ?? null));
  }, [session]);

  // ---- data ----
  const load = React.useCallback(async () => {
    const [profiles, events, eventPlayers, payments, matches, posts, points] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("events").select("*").order("starts_at", { ascending: false }),
      supabase.from("event_players").select("*"),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("matches").select("*").order("created_at", { ascending: false }),
      supabase.from("feed_posts").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("player_points").select("*"),
    ]);
    setDb({
      profiles: profiles.data || [], events: events.data || [], eventPlayers: eventPlayers.data || [],
      payments: payments.data || [], matches: matches.data || [], posts: posts.data || [], points: points.data || [],
    });
  }, []);

  React.useEffect(() => { if (me?.is_admin) load(); }, [me, load]);

  const signIn = () => supabase.auth.signInWithOAuth({
    provider: "google", options: { redirectTo: window.location.origin + "/admin" },
  });

  // ---- maps ----
  const byId = React.useMemo(() => Object.fromEntries(db.profiles.map((p) => [p.id, p])), [db.profiles]);
  const evById = React.useMemo(() => Object.fromEntries(db.events.map((e) => [e.id, e])), [db.events]);
  const nameOf = (id) => byId[id]?.full_name || byId[id]?.username || (id ? id.slice(0, 8) : "—");

  // ---- actions ----
  const createEvent = async () => {
    if (!form.title.trim()) return toast("Title required");
    setBusy(true);
    const row = {
      title: form.title.trim(), type: form.type,
      starts_at: (form.when ? new Date(form.when) : new Date(Date.now() + 86400000)).toISOString(),
      venue: form.venue || "TBD", fee: Number(form.fee) || 0,
      courts: Number(form.courts) || 4, max_players: Number(form.max) || 16,
      description: form.desc || "", created_by: session.user.id,
      source: form.source || null, source_url: form.source_url || null, source_ref: form.source_ref || null,
    };
    // re-importing the same reclub event syncs (upsert on its ref) instead of duplicating
    const { error } = form.source_ref
      ? await supabase.from("events").upsert(row, { onConflict: "source_ref" })
      : await supabase.from("events").insert(row);
    setBusy(false);
    if (error) return toast(error.message);
    toast(form.source_ref ? "Synced from reclub ✓" : "Event created");
    setForm({ ...form, title: "", source: "", source_ref: "", source_url: "" });
    load();
  };

  // fully-automatic: paste a reclub link → edge function fetches & parses → fill the form
  const importLink = async () => {
    if (!link.trim()) return toast("Paste a reclub link first");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("import-reclub", { body: { url: link.trim() } });
    setBusy(false);
    if (error || data?.error) return toast(data?.error || "Could not fetch that link");
    setForm((f) => ({
      ...f,
      title: data.title ?? f.title, type: data.type ?? f.type, when: data.when ?? f.when,
      venue: data.venue ?? f.venue, fee: data.fee ?? f.fee,
      courts: data.courts ?? f.courts, max: data.max ?? f.max, desc: data.desc ?? f.desc,
      source: data.source || "reclub", source_ref: data.source_ref || "", source_url: data.source_url || link.trim(),
    }));
    toast(`Imported from reclub (${data.parsed_from}) — review & Create`);
  };

  // one-click refresh of a reclub-imported event from its source link.
  // updates the live fields but preserves the admin's chosen status.
  const syncEvent = async (e) => {
    if (!e.source_url) return toast("No source link to sync from");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("import-reclub", { body: { url: e.source_url } });
    if (error || data?.error) { setBusy(false); return toast(data?.error || "Sync failed"); }
    const upd = {
      title: data.title || e.title, type: data.type || e.type, venue: data.venue || e.venue,
      fee: typeof data.fee === "number" ? data.fee : e.fee,
      courts: data.courts || e.courts, max_players: data.max || e.max_players,
      description: data.desc ?? e.description,
    };
    if (data.when) upd.starts_at = new Date(data.when).toISOString();
    const { error: e2 } = await supabase.from("events").update(upd).eq("id", e.id);
    setBusy(false);
    if (e2) return toast(e2.message);
    toast("Synced from reclub ✓"); load();
  };

  // placeholder roster (from reclub-generated events): edit / fulfill with emails
  const openRoster = (e) => { setRosterFor(e.id); setRosterDraft(Array.isArray(e.roster) ? e.roster.map((s) => ({ name: s.name || "", email: s.email || "" })) : []); };
  const saveRoster = async () => {
    const clean = rosterDraft.map((s) => ({ name: (s.name || "").trim() || "Player", email: (s.email || "").trim() || null }));
    const { error } = await supabase.from("events").update({ roster: clean }).eq("id", rosterFor);
    if (error) return toast(error.message);
    toast("Roster saved ✓"); setRosterFor(null); load();
  };

  const setEventStatus = async (id, status) => {
    const { error } = await supabase.from("events").update({ status }).eq("id", id);
    if (error) return toast(error.message);
    toast("Status → " + status); load();
  };

  const toggle = async (p, field) => {
    const { error } = await supabase.from("profiles").update({ [field]: !p[field] }).eq("id", p.id);
    if (error) return toast(error.message);
    toast(p.full_name + ": " + field + " " + (!p[field] ? "on" : "off")); load();
  };

  const postAnnouncement = async () => {
    if (!announce.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("feed_posts").insert({
      author: session.user.id, kind: "announcement", text: announce.trim(), score: "", sub: "Pengumuman",
    });
    setBusy(false);
    if (error) return toast(error.message);
    toast("Posted to feed"); setAnnounce(""); load();
  };

  // ---- demo mode actions ----
  // Create a temporary player (a real auth user so the id is permanent). An
  // email is optional now and can be linked later; once a real person signs in
  // with that email they keep this same profile and its points.
  const provisionPlayer = async () => {
    if (!pForm.full_name.trim()) return toast("Name required");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("provision-player", {
      body: { action: "create", full_name: pForm.full_name.trim(), email: pForm.email.trim(), phone: pForm.phone.trim() },
    });
    setBusy(false);
    if (error || data?.error) return toast(data?.error || error?.message || "Provision failed");
    toast("Temporary player created"); setPForm({ full_name: "", email: "", phone: "" }); load();
  };

  const linkLoginEmail = async () => {
    if (!linkPick) return toast("Pick a player");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("provision-player", {
      body: { action: "set_email", player_id: linkPick, email: linkEmail.trim() },
    });
    setBusy(false);
    if (error || data?.error) return toast(data?.error || error?.message || "Link failed");
    toast("Email linked — they can sign in with it to continue this id"); setLinkEmail("");
  };

  // Demo events carry is_demo=true so the player app hides them (and their
  // matches/feed) until promoted. They still feed the real leaderboard.
  const createDemoEvent = async () => {
    if (!dForm.title.trim()) return toast("Title required");
    setBusy(true);
    const { data, error } = await supabase.from("events").insert({
      title: dForm.title.trim(), type: dForm.type,
      starts_at: new Date().toISOString(), venue: VENUE_DEFAULT, fee: 0,
      description: "", created_by: session.user.id, status: "live", is_demo: true,
    }).select().single();
    setBusy(false);
    if (error) return toast(error.message);
    toast("Demo event created (hidden from players)");
    setDForm({ title: "", type: "Americano" });
    await load();
    if (data?.id) setDemoEvent(data.id);
  };

  // "Go live": reveal the demo event and its matches to everyone. (Result feed
  // posts written during the demo stay hidden — feed_posts aren't keyed by event
  // — but the leaderboard already reflects the points, and matches after this
  // point post normally.)
  const goLive = async (eventId) => {
    const { error } = await supabase.from("events").update({ is_demo: false }).eq("id", eventId);
    if (error) return toast(error.message);
    toast("Event is live — now visible to players"); load();
  };

  // Payment bypass: admins may write event_players.paid directly (admin manage
  // rosters policy), so a demo player joins as paid without a Xendit invoice.
  const addToRoster = async () => {
    if (!demoEvent || !rosterPick) return toast("Pick an event and a player");
    const { error } = await supabase.from("event_players")
      .upsert({ event_id: demoEvent, player_id: rosterPick, status: "paid", paid: true }, { onConflict: "event_id,player_id" });
    if (error) return toast(error.message);
    toast("Added & marked paid (payment bypassed)"); setRosterPick(""); load();
  };

  const markPaid = async (eventId, playerId) => {
    const { error } = await supabase.from("event_players")
      .update({ status: "paid", paid: true }).eq("event_id", eventId).eq("player_id", playerId);
    if (error) return toast(error.message);
    toast("Marked paid"); load();
  };

  const createMatch = async () => {
    const teamA = [mForm.a1, mForm.a2].filter(Boolean);
    const teamB = [mForm.b1, mForm.b2].filter(Boolean);
    if (!demoEvent) return toast("Pick a demo event");
    if (!teamA.length || !teamB.length) return toast("Pick at least one player per team");
    if (teamA.some((id) => teamB.includes(id))) return toast("A player can't be on both teams");
    const rounds = db.matches.filter((m) => m.event_id === demoEvent).map((m) => m.round);
    const round = rounds.length ? Math.max(...rounds) + 1 : 1;
    const { error } = await supabase.from("matches").insert({
      event_id: demoEvent, round, court: Number(mForm.court) || 1,
      team_a: teamA, team_b: teamB,
      team_a_names: teamA.map(nameOf).join(" & "),
      team_b_names: teamB.map(nameOf).join(" & "),
    });
    if (error) return toast(error.message);
    toast("Match created"); setMForm({ a1: "", a2: "", b1: "", b2: "", court: 1 }); load();
  };

  const scoreMatch = async (matchId, side, d) => {
    const m = db.matches.find((x) => x.id === matchId);
    if (!m) return;
    const col = side === "A" ? "score_a" : "score_b";
    const val = Math.max(0, m[col] + d);
    const { error } = await supabase.from("matches").update({ [col]: val }).eq("id", matchId);
    if (error) return toast(error.message);
    load();
  };

  const finishMatch = async (matchId) => {
    const { error } = await supabase.rpc("finish_match", { p_match_id: matchId });
    if (error) return toast(error.message);
    toast("Match finished — points added to the real leaderboard"); load();
  };

  // ---- gates ----
  const theme = tpTheme(THEME);
  const wrap = (children) => (
    <div style={{ ...theme, minHeight: "100dvh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-body)" }}>{children}</div>
  );

  if (session === undefined || (session && me === undefined)) {
    return wrap(<div style={{ display: "flex", height: "100dvh", alignItems: "center", justifyContent: "center" }}><div style={{ animation: "tpPulse 1.2s infinite" }}><CourtBadge size={52} /></div></div>);
  }
  if (!session) {
    return wrap(
      <div style={{ display: "flex", height: "100dvh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 34 }}>🔒</div>
        <h1 style={{ fontFamily: "var(--font-display)", margin: 0 }}>Admin Console</h1>
        <p style={{ color: "var(--text2)", maxWidth: 360 }}>Sign in with the Google account that has superadmin access.</p>
        <button onClick={signIn} style={btn("var(--accent)")}>Continue with Google</button>
      </div>
    );
  }
  if (!me?.is_admin) {
    return wrap(
      <div style={{ display: "flex", height: "100dvh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 34 }}>⛔</div>
        <h1 style={{ fontFamily: "var(--font-display)", margin: 0 }}>Not authorized</h1>
        <p style={{ color: "var(--text2)", maxWidth: 420 }}>
          This account ({session.user.email}) is not a superadmin. Run <code>0002_admin.sql</code> and set
          <code> is_admin = true</code> for your profile, then sign out and back in.
        </p>
        <button onClick={() => supabase.auth.signOut()} style={btn("var(--surface)")}>Sign out</button>
      </div>
    );
  }

  // ---- metrics ----
  const revenue = db.payments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
  const pending = db.payments.filter((p) => p.status === "pending").length;
  const activeEvents = db.events.filter((e) => e.status === "open" || e.status === "live").length;
  const liveMatches = db.matches.filter((m) => m.status === "live").length;
  const paidByEvent = (id) => db.eventPlayers.filter((ep) => ep.event_id === id && ep.paid).length;

  const TABS = [
    ["overview", "Overview", "📊"], ["members", "Members", "👥"], ["payments", "Payments", "💳"],
    ["events", "Events", "🎾"], ["matches", "Matches", "🏸"], ["content", "Content", "📣"],
    ...(DEMO_ENABLED ? [["demo", "Demo", "🧪"]] : []),
  ];

  const demoEvents = db.events.filter((e) => e.is_demo);
  const demoRoster = db.eventPlayers.filter((ep) => ep.event_id === demoEvent);
  const demoMatches = db.matches.filter((m) => m.event_id === demoEvent);

  return wrap(
    <div style={{ display: "flex", minHeight: "100dvh" }}>
      {/* sidebar */}
      <aside style={{ width: 210, flexShrink: 0, borderRight: "1px solid var(--line)", padding: 16, display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 0, height: "100dvh", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <CourtBadge size={30} radius={9} />
          <b style={{ fontFamily: "var(--font-display)" }}>Admin</b>
        </div>
        {TABS.map(([k, label, ic]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            ...btn(tab === k ? "var(--accent)" : "transparent"), justifyContent: "flex-start", gap: 9,
            color: tab === k ? "#000" : "var(--text)", fontWeight: tab === k ? 700 : 500,
          }}><span>{ic}</span>{label}</button>
        ))}
        <div style={{ marginTop: "auto", fontSize: 12, color: "var(--text2)" }}>
          <div style={{ marginBottom: 8 }}>{me.full_name || session.user.email}</div>
          <a href="/" style={{ color: "var(--text2)", display: "block", marginBottom: 6 }}>← Back to app</a>
          <a href="/GUIDE.pdf" download style={{ color: "var(--text2)", display: "block", marginBottom: 6 }}>📄 Download Guide</a>
          <button onClick={() => supabase.auth.signOut()} style={{ ...btn("var(--surface)"), padding: "7px 10px", fontSize: 12 }}>Sign out</button>
        </div>
      </aside>

      {/* main */}
      <main style={{ flex: 1, padding: 24, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h1 style={{ fontFamily: "var(--font-display)", margin: 0, textTransform: "capitalize" }}>{tab}</h1>
          <button onClick={load} style={{ ...btn("var(--surface)"), padding: "8px 14px" }}>↻ Refresh</button>
        </div>

        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
            <Stat label="Members" value={db.profiles.length} />
            <Stat label="Revenue (paid)" value={idr(revenue)} />
            <Stat label="Pending payments" value={pending} />
            <Stat label="Active events" value={activeEvents} />
            <Stat label="Live matches" value={liveMatches} />
            <Stat label="Feed posts" value={db.posts.length} />
          </div>
        )}

        {tab === "members" && (
          <Table head={["Player", "Username", "City", "Skill", "Joined", "Host", "Admin"]}>
            {db.profiles.map((p) => (
              <tr key={p.id} style={trS}>
                <Td><Av name={p.full_name} /> {p.full_name || "—"}</Td>
                <Td>{p.username || "—"}</Td><Td>{p.city || "—"}</Td><Td>{p.skill || "—"}</Td>
                <Td>{fmt(p.created_at, false)}</Td>
                <Td><Switch on={p.is_host} onClick={() => toggle(p, "is_host")} /></Td>
                <Td><Switch on={p.is_admin} onClick={() => toggle(p, "is_admin")} /></Td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "payments" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
              {["all", "paid", "pending", "expired", "failed"].map((s) => (
                <button key={s} onClick={() => setPayFilter(s)} style={{ ...btn(payFilter === s ? "var(--accent)" : "var(--surface)"), padding: "6px 12px", fontSize: 13, color: payFilter === s ? "#000" : "var(--text)", textTransform: "capitalize" }}>{s}</button>
              ))}
              <select value={payEvent} onChange={(e) => setPayEvent(e.target.value)} style={{ ...inp, padding: "6px 10px", marginLeft: "auto", maxWidth: 260 }}>
                <option value="all">All sessions</option>
                {db.events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
            {(() => {
              const rows = db.payments.filter((p) => (payFilter === "all" || p.status === payFilter) && (payEvent === "all" || p.event_id === payEvent));
              const collected = rows.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
              return <div style={{ marginBottom: 10, color: "var(--text2)", fontSize: 13 }}>{rows.length} payment(s){payEvent !== "all" ? " · " + (evById[payEvent]?.title || "session") : ""} · collected {idr(collected)}</div>;
            })()}
            <Table head={["Date", "Player", "Event", "Amount", "Method", "Status", "Invoice"]}>
              {db.payments.filter((p) => (payFilter === "all" || p.status === payFilter) && (payEvent === "all" || p.event_id === payEvent)).map((p) => (
                <tr key={p.id} style={trS}>
                  <Td>{fmt(p.created_at)}</Td><Td>{nameOf(p.player_id)}</Td>
                  <Td>{evById[p.event_id]?.title || "—"}</Td><Td>{idr(p.amount)}</Td>
                  <Td>{p.method || "—"}</Td>
                  <Td><span style={{ color: PAY_COLORS[p.status] || "var(--text2)", fontWeight: 700 }}>{p.status}</span></Td>
                  <Td>{p.invoice_url ? <a href={p.invoice_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>open ↗</a> : "—"}</Td>
                </tr>
              ))}
            </Table>
          </>
        )}

        {tab === "events" && (
          <>
            <div style={card}>
              <b style={{ display: "block", marginBottom: 10 }}>Create event</b>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  value={link} onChange={(e) => setLink(e.target.value)}
                  placeholder="Paste a reclub event link (https://reclub.co/…) for auto-import"
                  style={{ ...inp, flex: 1 }} />
                <button onClick={importLink} disabled={busy} style={{ ...btn("var(--accent)"), whiteSpace: "nowrap" }}>{busy ? "…" : "🔗 Fetch from link"}</button>
              </div>
              <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8 }}>…or paste the caption text:</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
                <textarea
                  value={paste} onChange={(e) => setPaste(e.target.value)}
                  placeholder="Paste a reclub / WhatsApp / IG event caption here, then Parse & fill ↓"
                  style={{ ...inp, flex: 1, minHeight: 64, resize: "vertical", fontFamily: "inherit" }} />
                <button
                  onClick={() => { if (!paste.trim()) return toast("Paste a caption first"); setForm((f) => ({ ...f, ...parseFlyer(paste) })); toast("Parsed — review the fields, then Create"); }}
                  style={{ ...btn("var(--accent)"), whiteSpace: "nowrap" }}>✨ Parse &amp; fill</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8 }}>
                <input style={inp} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <select style={inp} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                <input style={inp} type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} />
                <input style={inp} placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
                <input style={inp} type="number" placeholder="Fee" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
                <input style={inp} type="number" placeholder="Courts" value={form.courts} onChange={(e) => setForm({ ...form, courts: e.target.value })} />
                <input style={inp} type="number" placeholder="Max players" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />
                <button onClick={createEvent} disabled={busy} style={btn("var(--accent)")}>{busy ? "…" : "Create"}</button>
              </div>
            </div>
            {rosterFor && (
              <div style={{ ...card, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>Placeholder roster — {evById[rosterFor]?.title || ""}</b>
                  <button onClick={() => setRosterFor(null)} style={{ ...btn("var(--surface)"), padding: "4px 9px" }}>✕</button>
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)", margin: "4px 0 10px" }}>Fill a real email to assign a slot to a player. Add or remove slots as needed.</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {rosterDraft.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 6 }}>
                      <input style={{ ...inp, flex: "0 0 130px" }} value={s.name} placeholder={"Player " + (i + 1)}
                        onChange={(e) => setRosterDraft((d) => d.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                      <input style={{ ...inp, flex: 1 }} type="email" value={s.email} placeholder="real email (optional)"
                        onChange={(e) => setRosterDraft((d) => d.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                      <button onClick={() => setRosterDraft((d) => d.filter((_, j) => j !== i))} style={{ ...btn("var(--surface)"), padding: "5px 10px" }}>✕</button>
                    </div>
                  ))}
                  {rosterDraft.length === 0 && <div style={{ fontSize: 12, color: "var(--text2)" }}>No placeholder slots yet.</div>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => setRosterDraft((d) => [...d, { name: "", email: "" }])} style={btn("var(--surface)")}>+ Add slot</button>
                  <button onClick={saveRoster} disabled={busy} style={btn("var(--accent)")}>Save roster</button>
                </div>
              </div>
            )}
            <Table head={["Title", "Type", "When", "Venue", "Fee", "Paid/Max", "Status"]}>
              {db.events.map((e) => (
                <tr key={e.id} style={trS}>
                  <Td>{e.title} {e.is_demo && <span style={demoPill}>DEMO</span>}</Td><Td>{e.type}</Td><Td>{fmt(e.starts_at)}</Td><Td>{e.venue}</Td>
                  <Td>{idr(e.fee)}</Td><Td>{paidByEvent(e.id)}/{e.max_players}</Td>
                  <Td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select value={e.status} onChange={(ev) => setEventStatus(e.id, ev.target.value)} style={{ ...inp, padding: "5px 8px" }}>
                        {EVENT_STATUS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      {e.source === "reclub" && (
                        <button onClick={() => syncEvent(e)} disabled={busy} title={"Re-sync from " + (e.source_url || "reclub")}
                          style={{ ...btn("var(--surface)"), padding: "5px 9px", whiteSpace: "nowrap" }}>🔄</button>
                      )}
                      <button onClick={() => openRoster(e)} title="Placeholder roster"
                        style={{ ...btn("var(--surface)"), padding: "5px 9px", whiteSpace: "nowrap" }}>👥 {Array.isArray(e.roster) ? e.roster.length : 0}</button>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          </>
        )}

        {tab === "matches" && (
          <Table head={["Event", "Round", "Court", "Team A", "Team B", "Score", "Status"]}>
            {db.matches.map((m) => (
              <tr key={m.id} style={trS}>
                <Td>{evById[m.event_id]?.title || "—"} {evById[m.event_id]?.is_demo && <span style={demoPill}>DEMO</span>}</Td><Td>{m.round}</Td><Td>{courtName(m.court)}</Td>
                <Td>{m.team_a_names}</Td><Td>{m.team_b_names}</Td>
                <Td>{m.score_a}–{m.score_b}</Td>
                <Td><span style={{ color: m.status === "live" ? "#46d369" : "var(--text2)", fontWeight: 700 }}>{m.status}</span></Td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "content" && (
          <>
            <div style={card}>
              <b style={{ display: "block", marginBottom: 10 }}>Post announcement to the community feed</b>
              <textarea style={{ ...inp, width: "100%", minHeight: 80, resize: "vertical", boxSizing: "border-box" }} placeholder="Write an announcement…" value={announce} onChange={(e) => setAnnounce(e.target.value)} />
              <button onClick={postAnnouncement} disabled={busy} style={{ ...btn("var(--accent)"), marginTop: 8 }}>{busy ? "…" : "Publish"}</button>
            </div>
            <Table head={["Date", "Author", "Kind", "Text"]}>
              {db.posts.map((p) => (
                <tr key={p.id} style={trS}>
                  <Td>{fmt(p.created_at)}</Td><Td>{nameOf(p.author)}</Td><Td>{p.kind}</Td>
                  <Td>{p.text}{p.score ? " (" + p.score + ")" : ""}</Td>
                </tr>
              ))}
            </Table>
          </>
        )}

        {tab === "demo" && DEMO_ENABLED && (
          <>
            <div style={{ ...card, borderColor: "var(--accent)" }}>
              <b style={{ display: "block", marginBottom: 4 }}>🧪 Demo Mode — manual fulfilment</b>
              <p style={{ color: "var(--text2)", fontSize: 13, margin: 0 }}>
                Run the whole flow by hand for a demo: create temporary players, add them to an
                event without payment, score and finish matches. <b>Results feed the real
                leaderboard</b>, so demo players keep their id and points when they go live.
              </p>
            </div>

            {/* 1. provision a temporary player */}
            <div style={card}>
              <b style={{ display: "block", marginBottom: 10 }}>Add temporary player</b>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8 }}>
                <input style={inp} placeholder="Full name" value={pForm.full_name} onChange={(e) => setPForm({ ...pForm, full_name: e.target.value })} />
                <input style={inp} type="email" placeholder="Login email (optional)" value={pForm.email} onChange={(e) => setPForm({ ...pForm, email: e.target.value })} />
                <input style={inp} placeholder="Phone (optional)" value={pForm.phone} onChange={(e) => setPForm({ ...pForm, phone: e.target.value })} />
                <button onClick={provisionPlayer} disabled={busy} style={btn("var(--accent)")}>{busy ? "…" : "Create player"}</button>
              </div>
              <p style={{ color: "var(--text2)", fontSize: 12, margin: "10px 0 0" }}>
                Leave email blank to create a placeholder — link a real email later below.
              </p>
            </div>

            {/* 2. link a login email later */}
            <div style={card}>
              <b style={{ display: "block", marginBottom: 10 }}>Link login email</b>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
                <select style={inp} value={linkPick} onChange={(e) => setLinkPick(e.target.value)}>
                  <option value="">Select player…</option>
                  {db.profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.username || p.id.slice(0, 8)}</option>)}
                </select>
                <input style={inp} type="email" placeholder="email@example.com" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} />
                <button onClick={linkLoginEmail} disabled={busy} style={btn("var(--accent)")}>{busy ? "…" : "Link email"}</button>
              </div>
              <p style={{ color: "var(--text2)", fontSize: 12, margin: "10px 0 0" }}>
                When this person signs in with Google or an email magic-link using this address,
                they continue this same id. (Requires same-email identity linking enabled in Supabase Auth.)
              </p>
            </div>

            {/* 3. create / pick the demo event */}
            <div style={card}>
              <b style={{ display: "block", marginBottom: 10 }}>Demo event</b>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <input style={{ ...inp, minWidth: 200 }} placeholder="New demo event title" value={dForm.title} onChange={(e) => setDForm({ ...dForm, title: e.target.value })} />
                <select style={inp} value={dForm.type} onChange={(e) => setDForm({ ...dForm, type: e.target.value })}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                <button onClick={createDemoEvent} disabled={busy} style={btn("var(--accent)")}>{busy ? "…" : "Create demo event"}</button>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select style={{ ...inp, minWidth: 240 }} value={demoEvent} onChange={(e) => setDemoEvent(e.target.value)}>
                  <option value="">Select a demo event…</option>
                  {demoEvents.map((e) => <option key={e.id} value={e.id}>{e.title} · {e.type}</option>)}
                </select>
                {demoEvent && <button onClick={() => goLive(demoEvent)} style={btn("var(--surface)")}>🚀 Go live (reveal to players)</button>}
                <span style={{ ...demoPill }}>DEMO · hidden from players</span>
              </div>
              {!demoEvents.length && <p style={{ color: "var(--text2)", fontSize: 12, margin: "10px 0 0" }}>No demo events yet — create one above.</p>}
            </div>

            {demoEvent && (
              <>
                {/* roster: add players, mark paid (bypass) */}
                <div style={card}>
                  <b style={{ display: "block", marginBottom: 10 }}>Roster — {evById[demoEvent]?.title}</b>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    <select style={{ ...inp, minWidth: 200 }} value={rosterPick} onChange={(e) => setRosterPick(e.target.value)}>
                      <option value="">Add player…</option>
                      {db.profiles.filter((p) => !demoRoster.some((ep) => ep.player_id === p.id)).map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name || p.username || p.id.slice(0, 8)}</option>
                      ))}
                    </select>
                    <button onClick={addToRoster} style={btn("var(--accent)")}>Add &amp; mark paid</button>
                  </div>
                  <Table head={["Player", "Status", "Paid", ""]}>
                    {demoRoster.map((ep) => (
                      <tr key={ep.player_id} style={trS}>
                        <Td><Av name={byId[ep.player_id]?.full_name} /> {nameOf(ep.player_id)}</Td>
                        <Td>{ep.status}</Td>
                        <Td><span style={{ color: ep.paid ? "#46d369" : "var(--text2)", fontWeight: 700 }}>{ep.paid ? "yes" : "no"}</span></Td>
                        <Td>{!ep.paid && <button onClick={() => markPaid(demoEvent, ep.player_id)} style={{ ...btn("var(--surface)"), padding: "5px 10px", fontSize: 12 }}>Mark paid</button>}</Td>
                      </tr>
                    ))}
                  </Table>
                </div>

                {/* matches: create, score, finish */}
                <div style={card}>
                  <b style={{ display: "block", marginBottom: 10 }}>New match</b>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8, alignItems: "center" }}>
                    {[["a1", "Team A · player 1"], ["a2", "Team A · player 2"], ["b1", "Team B · player 1"], ["b2", "Team B · player 2"]].map(([k, label]) => (
                      <select key={k} style={inp} value={mForm[k]} onChange={(e) => setMForm({ ...mForm, [k]: e.target.value })}>
                        <option value="">{label}</option>
                        {demoRoster.map((ep) => <option key={ep.player_id} value={ep.player_id}>{nameOf(ep.player_id)}</option>)}
                      </select>
                    ))}
                    <input style={inp} type="number" min={1} placeholder="Court" value={mForm.court} onChange={(e) => setMForm({ ...mForm, court: e.target.value })} />
                    <button onClick={createMatch} style={btn("var(--accent)")}>Create match</button>
                  </div>
                  {!demoRoster.length && <p style={{ color: "var(--text2)", fontSize: 12, margin: "10px 0 0" }}>Add players to the roster first.</p>}
                </div>

                <Table head={["Round", "Court", "Team A", "Score", "Team B", "Status", ""]}>
                  {demoMatches.map((m) => (
                    <tr key={m.id} style={trS}>
                      <Td>{m.round}</Td><Td>{courtName(m.court)}</Td>
                      <Td>{m.team_a_names}</Td>
                      <Td>
                        {m.status === "live" ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <button onClick={() => scoreMatch(m.id, "A", -1)} style={stepBtn}>−</button>
                            <b style={{ minWidth: 44, textAlign: "center", display: "inline-block" }}>{m.score_a}–{m.score_b}</b>
                            <button onClick={() => scoreMatch(m.id, "A", +1)} style={stepBtn}>+</button>
                            <span style={{ color: "var(--text2)" }}>/</span>
                            <button onClick={() => scoreMatch(m.id, "B", -1)} style={stepBtn}>−</button>
                            <button onClick={() => scoreMatch(m.id, "B", +1)} style={stepBtn}>+</button>
                          </span>
                        ) : <b>{m.score_a}–{m.score_b}</b>}
                      </Td>
                      <Td>{m.team_b_names}</Td>
                      <Td><span style={{ color: m.status === "live" ? "#46d369" : "var(--text2)", fontWeight: 700 }}>{m.status}</span></Td>
                      <Td>{m.status === "live" && <button onClick={() => finishMatch(m.id)} style={{ ...btn("var(--accent)"), padding: "5px 10px", fontSize: 12 }}>Finish</button>}</Td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
          </>
        )}
      </main>

      {toastMsg && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "var(--text)", color: "var(--bg)", padding: "10px 18px", borderRadius: 10, fontWeight: 600, zIndex: 50 }}>{toastMsg}</div>
      )}
    </div>
  );
}

// ---------- little styled helpers ----------
const btn = (bg) => ({ background: bg, border: "1px solid var(--line)", borderRadius: 9, padding: "9px 14px", color: "var(--text)", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 14, display: "flex", alignItems: "center" });
const inp = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 9, padding: "9px 11px", color: "var(--text)", fontSize: 14, fontFamily: "var(--font-body)", outline: "none" };
const card = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 18 };
const trS = { borderBottom: "1px solid var(--line)" };
const tdS = { padding: "10px 12px", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
const stepBtn = { width: 26, height: 26, borderRadius: 7, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", fontSize: 15, lineHeight: 1, fontWeight: 700 };
const demoPill = { fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: "#e6a700", border: "1px solid #e6a70055", background: "#e6a7001a", borderRadius: 999, padding: "3px 8px" };

function Td({ children }) { return <td style={tdS}>{children}</td>; }
function Table({ head, children }) {
  return (
    <div style={{ ...card, padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{head.map((h) => <th key={h} style={{ ...tdS, textAlign: "left", color: "var(--text2)", fontWeight: 600, borderBottom: "1px solid var(--line)" }}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Stat({ label, value }) {
  return (
    <div style={card}>
      <div style={{ color: "var(--text2)", fontSize: 13 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}
function Av({ name }) {
  return <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", color: "#000", fontSize: 10, fontWeight: 700, alignItems: "center", justifyContent: "center", marginRight: 6, verticalAlign: "middle" }}>{initials(name)}</span>;
}
function Switch({ on, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 40, height: 22, borderRadius: 22, border: "none", cursor: "pointer", background: on ? "var(--accent)" : "var(--line)", position: "relative", transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
    </button>
  );
}
