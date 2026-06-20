import React from "react";
import { supabase } from "../lib/supabase.js";
import { Disp, Body, Num, Card, Ava, Pill, Btn, Seg, Row, Col, SecHead } from "../components/atoms.jsx";
import { courtName } from "../lib/courts.js";
import { sessionConfig, buildRound, matchComplete } from "../lib/session.js";

// Organizer's self-service session console. Lives entirely in the player app —
// no admin "go live" required. The event creator (or any host/admin) can:
//   • generate / regenerate rounds anytime (not gated by status or schedule)
//   • enter & edit scores anytime (never time-gated)
//   • pause / resume / finish the session (status is info only)
//   • edit player display names and swap the account in any slot
//   • reorder matches (up / down)
//   • edit format settings after generate (Americano/Mexicano, fixed partner,
//     point/ranking, rounds, race-to / best-of) with a destructive-recompute warning

const firstName = (n) => (n || "Player").trim().split(/\s+/)[0];
const initialsOf = (n) =>
  (n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

const STATUS_LABEL = { open: "Scheduled", live: "Live", paused: "Paused", done: "Finished", cancelled: "Cancelled" };
const STATUS_COLOR = { open: "var(--text2)", live: "var(--danger)", paused: "#E6A23C", done: "var(--success)", cancelled: "var(--text2)" };

// per-MATCH status (matches.status: live | done | cancelled). Distinct from the
// event status above. Drives the per-match badge + host override controls (B2).
const MATCH_STATUS = {
  live:      { label: "Live",      color: "var(--danger)" },
  done:      { label: "Done",      color: "var(--success)" },
  cancelled: { label: "Cancelled", color: "var(--text2)" },
};

// responsive helper: side-by-side on a wide screen, stacked on a phone (B1).
function useWide(min = 900) {
  const q = `(min-width: ${min}px)`;
  const [wide, setWide] = React.useState(
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(q).matches : false));
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(q);
    const on = (e) => setWide(e.matches);
    setWide(mq.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); };
  }, [q]);
  return wide;
}

export function StatusBadge({ status, onClick }) {
  const s = status || "open";
  return (
    <Row gap={6} onClick={onClick} style={{
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999,
      padding: "5px 11px", cursor: onClick ? "pointer" : "default",
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[s],
        animation: s === "live" ? "tpPulse 1.2s infinite" : "none",
      }} />
      <Body size={11.5} bold>{STATUS_LABEL[s] || s}</Body>
    </Row>
  );
}

export function SessionManager({ eventId, db, uid, refresh, toast, onClose }) {
  const ev = db.events.find((e) => e.id === eventId);
  const wide = useWide(900);
  const cfg = React.useMemo(() => sessionConfig(ev), [ev]);
  const [draft, setDraft] = React.useState(cfg);
  React.useEffect(() => { setDraft(sessionConfig(ev)); }, [ev]);

  const profilesById = React.useMemo(
    () => Object.fromEntries(db.profiles.map((p) => [p.id, p])), [db.profiles]);

  // name-only players (imported from a reclub roster or added by hand) live in
  // config.lineup as { id, name }. They get a generated id so they can be placed
  // in matches and tracked across rounds without needing a real account.
  const lineup = Array.isArray(ev?.config?.lineup) ? ev.config.lineup : [];
  const lineupNames = Object.fromEntries(lineup.map((p) => [p.id, p.name]));

  // registered players (real accounts) for this event — payment not required
  const registeredIds = db.eventPlayers
    .filter((ep) => ep.event_id === eventId && ep.status !== "rejected")
    .map((ep) => ep.player_id);

  // the session roster = registered accounts + name-only lineup entries
  const roster = [...new Set([...registeredIds, ...lineup.map((p) => p.id)])];

  const names = (ev?.config?.names) || {};
  const nameOf = (id) => names[id] || lineupNames[id] || firstName(profilesById[id]?.full_name);

  const matches = db.matches
    .filter((m) => m.event_id === eventId)
    .sort((a, b) => a.round - b.round || a.order_index - b.order_index || a.court - b.court);
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const lastRound = rounds.length ? Math.max(...rounds) : 0;

  // Mexicano gate: the next round's pairings are seeded from the CURRENT round's
  // results, so we must not generate until every match in the active round has a
  // final score. (Americano just rotates the roster, so it isn't gated.)
  const lastRoundMatches = matches.filter((m) => m.round === lastRound);
  const gateActive = draft.format === "mexicano" && lastRound > 0;
  const unscored = gateActive
    ? lastRoundMatches.filter((m) => !matchComplete({
        score_a: m.score_a, score_b: m.score_b, target: m.target, targetMode: draft.targetMode,
      }))
    : [];
  const canGenerate = !gateActive || unscored.length === 0;

  // players who already appeared in earlier rounds — the next round is generated
  // from THIS set (not the raw roster) so the lineup & names continue from the
  // previous generation. Falls back to the roster for the very first round.
  const playedIds = [...new Set(matches.flatMap((m) => [...m.team_a, ...m.team_b]))];

  // points-mode standings (sum of each player's team score across the session)
  const standingsIds = React.useMemo(() => {
    const acc = {};
    for (const m of matches) {
      for (const pid of m.team_a) acc[pid] = (acc[pid] || 0) + m.score_a;
      for (const pid of m.team_b) acc[pid] = (acc[pid] || 0) + m.score_b;
    }
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [matches]);

  // Live session leaderboard for the side-by-side panel (B1). Mirrors the 0021
  // session_leaderboard view: sum of each player's own-side score, with CANCELLED
  // matches EXCLUDED so a voided court never counts toward standings.
  const standings = React.useMemo(() => {
    const acc = {};
    for (const m of matches) {
      if (m.status === "cancelled") continue;
      for (const pid of m.team_a) acc[pid] = (acc[pid] || 0) + m.score_a;
      for (const pid of m.team_b) acc[pid] = (acc[pid] || 0) + m.score_b;
    }
    return Object.entries(acc)
      .map(([id, pts]) => ({ id, pts }))
      .sort((a, b) => b.pts - a.pts)
      .map((r, i) => ({ ...r, rank: i + 1, name: nameOf(r.id), me: r.id === uid }));
  }, [matches, names, lineupNames, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-load the reclub roster names into the lineup the first time this session
  // is opened — no manual import / re-typing. Each name gets a stable id so it
  // can be placed in matches and tracked across rounds. Players can claim/sign
  // in to these slots later.
  const autoImportRef = React.useRef(false);
  React.useEffect(() => {
    if (autoImportRef.current || !ev) return;
    const ph = (Array.isArray(ev.roster) ? ev.roster : []).filter((s) => s && s.name);
    const hasLineup = Array.isArray(ev.config?.lineup) && ev.config.lineup.length > 0;
    if (!ph.length || hasLineup || ev.config?.rosterImported) return;
    autoImportRef.current = true;
    const lineup = ph.map((s) => ({ id: crypto.randomUUID(), name: s.name }));
    supabase.from("events")
      .update({ config: { ...(ev.config || {}), lineup, rosterImported: true } })
      .eq("id", eventId)
      .then(({ error }) => { if (!error) { toast("Loaded " + lineup.length + " players from reclub"); refresh(); } });
  }, [ev, eventId, refresh, toast]);

  if (!ev) return null;

  // ---------- actions ----------
  // host-only: mint/return the share token and copy the public live leaderboard
  // link (/s/<token>). The RPC enforces host-only on the server.
  const shareLeaderboard = async () => {
    const { data, error } = await supabase.rpc("generate_share_token", { p_event: eventId });
    if (error) return toast(error.message);
    refresh(); // reflect the now-shared state in the header (ev.share_token)
    const url = `${window.location.origin}/s/${data}`;
    try {
      if (navigator.share) { await navigator.share({ title: (ev?.title || "Session") + " — live leaderboard", url }); return; }
      await navigator.clipboard.writeText(url);
      toast("Leaderboard link copied — anyone can watch live 📊");
    } catch (_) {
      try { await navigator.clipboard.writeText(url); toast("Leaderboard link copied 📊"); }
      catch { toast(url); }
    }
  };

  // host-only: turn sharing off — the RPC drops the token, so the current
  // /s/<token> link stops resolving (the public board renders its "not found"
  // state). The server re-checks host; this confirm is convenience only.
  const stopSharing = async () => {
    if (!window.confirm("Stop sharing the live leaderboard? The current public link will stop working.")) return;
    const { error } = await supabase.rpc("revoke_share_token", { p_event: eventId });
    if (error) return toast(error.message);
    toast("Sharing stopped — the public link is now disabled");
    refresh();
  };

  const setStatus = async (status) => {
    const { error } = await supabase.from("events").update({ status }).eq("id", eventId);
    if (error) return toast(error.message);
    toast("Status: " + (STATUS_LABEL[status] || status));
    refresh();
  };

  const persistConfig = async (next) => {
    const patch = { config: { ...(ev.config || {}), ...next } };
    // keep the legacy `type` label in sync with the chosen format
    if (next.format) patch.type = next.format === "mexicano" ? "Mexicano" : "Americano";
    const { error } = await supabase.from("events").update(patch).eq("id", eventId);
    if (error) { toast(error.message); return false; }
    return true;
  };

  const saveSettings = async () => {
    const next = {
      format: draft.format, fixedPartner: draft.fixedPartner, scoreMode: draft.scoreMode,
      rounds: draft.rounds, targetMode: draft.targetMode, target: draft.target,
    };
    if (await persistConfig(next)) { toast("Settings saved ✓"); refresh(); }
  };

  // mark registered players going into the lineup as paid participants so the
  // whole app counts them. Name-only lineup players have no account, so they are
  // skipped here (event_players.player_id must reference a real profile).
  const ensurePaid = async (ids) => {
    const realIds = ids.filter((id) => profilesById[id]);
    if (!realIds.length) return;
    const { error } = await supabase.from("event_players").upsert(
      realIds.map((id) => ({ event_id: eventId, player_id: id, status: "paid", paid: true })),
      { onConflict: "event_id,player_id" });
    if (error) toast(error.message);
  };

  // import the reclub placeholder names (events.roster) into the session lineup
  const importNames = async () => {
    const ph = (Array.isArray(ev.roster) ? ev.roster : []).filter((s) => s && s.name);
    if (!ph.length) return toast("No reclub names to import");
    const have = new Set(lineup.map((p) => (p.name || "").toLowerCase()));
    const additions = ph
      .filter((s) => !have.has(s.name.toLowerCase()))
      .map((s) => ({ id: crypto.randomUUID(), name: s.name }));
    if (!additions.length) return toast("Already imported");
    if (await persistConfig({ lineup: [...lineup, ...additions] })) {
      toast("Imported " + additions.length + " players"); refresh();
    }
  };

  const addPlayer = async (name) => {
    const n = (name || "").trim();
    if (!n) return;
    if (await persistConfig({ lineup: [...lineup, { id: crypto.randomUUID(), name: n }] })) refresh();
  };

  const removePlayer = async (id) => {
    if (await persistConfig({ lineup: lineup.filter((p) => p.id !== id) })) { toast("Removed"); refresh(); }
  };

  const insertRound = async (round, conf, baseIds) => {
    const { courts } = buildRound({ baseIds, standingsIds, config: conf, round, nameOf });
    if (!courts.length) { toast("Need at least 4 players to make a court"); return false; }
    const { error } = await supabase.from("matches").insert(courts.map((c) => ({
      event_id: eventId, round, court: c.court, order_index: c.order_index,
      team_a: c.team_a, team_b: c.team_b,
      team_a_names: c.team_a_names, team_b_names: c.team_b_names,
      target: conf.target, status: "live",
    })));
    if (error) { toast(error.message); return false; }
    return true;
  };

  const generateNext = async () => {
    // hard guard: never advance a Mexicano round while the current one is unscored,
    // even if the (disabled) button is somehow triggered.
    if (gateActive && unscored.length > 0) {
      toast(`Enter all scores first — ${unscored.length} match${unscored.length > 1 ? "es" : ""} in round ${lastRound} still need a final score`);
      return;
    }
    const round = lastRound + 1;
    if (round > draft.rounds) {
      if (!window.confirm(`That's past your ${draft.rounds}-round plan. Generate round ${round} anyway?`)) return;
    }
    // continue from the previous generation's players; round 1 uses the roster
    const baseIds = playedIds.length ? playedIds : roster;
    await ensurePaid(baseIds);
    if (await insertRound(round, draft, baseIds)) { toast("Round " + round + " generated 🎾"); refresh(); }
  };

  const regenerateAll = async () => {
    if (!window.confirm("Recompute the whole schedule? This deletes ALL existing matches and their scores for this session.")) return;
    await persistConfig({
      format: draft.format, fixedPartner: draft.fixedPartner, scoreMode: draft.scoreMode,
      rounds: draft.rounds, targetMode: draft.targetMode, target: draft.target,
    });
    const { error } = await supabase.from("matches").delete().eq("event_id", eventId);
    if (error) return toast(error.message);
    await ensurePaid(roster);
    if (await insertRound(1, draft, roster)) { toast("Schedule regenerated from round 1"); refresh(); }
  };

  const clearRound = async (round) => {
    if (!window.confirm("Delete round " + round + " and its scores?")) return;
    const { error } = await supabase.from("matches").delete().eq("event_id", eventId).eq("round", round);
    if (error) return toast(error.message);
    toast("Round " + round + " cleared"); refresh();
  };

  const score = async (m, side, d) => {
    const col = side === "A" ? "score_a" : "score_b";
    const val = Math.max(0, m[col] + d);
    await supabase.from("matches").update({ [col]: val }).eq("id", m.id);
    refresh();
  };

  // host-only manual status override (B2). Goes through the 0021 set_match_status
  // RPC, which re-checks host on the SERVER and rejects non-hosts — the client
  // gate here is convenience only. No scoring is re-run: the leaderboard derives
  // from matches.status, so the board follows the new status automatically.
  const setMatchStatus = async (m, status) => {
    if (m.status === status) return;
    if (status === "cancelled" &&
        !window.confirm("Cancel this match? Its scores stop counting toward the leaderboard.")) return;
    const { error } = await supabase.rpc("set_match_status", { p_match_id: m.id, p_status: status });
    if (error) return toast(error.message);
    toast("Match → " + (MATCH_STATUS[status]?.label || status));
    refresh();
  };

  const move = async (m, dir) => {
    const sameRound = matches.filter((x) => x.round === m.round);
    const idx = sameRound.findIndex((x) => x.id === m.id);
    const swapWith = sameRound[idx + dir];
    if (!swapWith) return;
    await Promise.all([
      supabase.from("matches").update({ order_index: swapWith.order_index }).eq("id", m.id),
      supabase.from("matches").update({ order_index: m.order_index }).eq("id", swapWith.id),
    ]);
    refresh();
  };

  // swap the account placed in a slot: team = 'A'|'B', pos = 0|1
  const swapSlot = async (m, team, pos, newId) => {
    const key = team === "A" ? "team_a" : "team_b";
    const arr = [...m[key]]; arr[pos] = newId;
    const namesArr = arr.map(nameOf).join(" / ");
    await supabase.from("matches").update({ [key]: arr, [team === "A" ? "team_a_names" : "team_b_names"]: namesArr })
      .eq("id", m.id);
    refresh();
  };

  // edit a player's display name for THIS session (stored in config.names) and
  // refresh the denormalized names on every match they appear in
  const renamePlayer = async (id, name) => {
    const nextNames = { ...names, [id]: name.trim() };
    if (!name.trim()) delete nextNames[id];
    await persistConfig({ names: nextNames });
    const resolve = (pid) => nextNames[pid] || firstName(profilesById[pid]?.full_name);
    const mine = matches.filter((m) => m.team_a.includes(id) || m.team_b.includes(id));
    await Promise.all(mine.map((m) => supabase.from("matches").update({
      team_a_names: m.team_a.map(resolve).join(" / "),
      team_b_names: m.team_b.map(resolve).join(" / "),
    }).eq("id", m.id)));
    toast("Name updated"); refresh();
  };

  // ---------- render ----------
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 75, background: "var(--bg)", display: "flex", flexDirection: "column", animation: "tpFade .15s" }}>
      <Row style={{ justifyContent: "space-between", padding: "calc(14px + env(safe-area-inset-top)) 16px 12px", borderBottom: "1px solid var(--line)" }}>
        <button onClick={onClose} style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 999, padding: "6px 13px", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Done</button>
        <Row gap={8}>
          {ev.share_token ? (
            <Row gap={6}>
              {/* sharing is ON: tap the pill to copy/re-share the live link, or Stop to disable it */}
              <button onClick={shareLeaderboard} title="Copy the live leaderboard link" style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent-soft)", border: "1px solid var(--accent)", color: "var(--text)", borderRadius: 999, padding: "6px 13px", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", animation: "tpPulse 1.2s infinite" }} />
                📊 Shared
              </button>
              <button onClick={stopSharing} title="Stop sharing — disable the public link" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text2)", borderRadius: 999, padding: "6px 11px", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Stop</button>
            </Row>
          ) : (
            <button onClick={shareLeaderboard} title="Share live leaderboard" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 999, padding: "6px 13px", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📊 Share</button>
          )}
          <StatusBadge status={ev.status} />
        </Row>
      </Row>

      {/* B1: host-only/internal — match view + leaderboard in ONE screen.
          Desktop = side-by-side; mobile = stacked (leaderboard on top). */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: wide ? "row" : "column" }}>
        {/* match view — full width on mobile, left column on desktop */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <Col gap={14} style={{ padding: "14px 16px calc(28px + env(safe-area-inset-bottom))" }}>
          {!wide && <SessionLeaderboard standings={standings} />}
          <Col gap={2}>
            <Body size={11.5} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>Manage session</Body>
            <Disp size={22}>{ev.title}</Disp>
            <Body size={12.5} dim>{roster.length} players · {matches.length} matches · {rounds.length}/{draft.rounds} rounds</Body>
          </Col>

          {/* status controls — informational, never gate generation or scoring */}
          <Card pad={12}>
            <Body size={11} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Status (info only)</Body>
            <Row gap={7} style={{ flexWrap: "wrap" }}>
              <Pill small on={ev.status === "open"} onClick={() => setStatus("open")}>Scheduled</Pill>
              <Pill small on={ev.status === "live"} onClick={() => setStatus("live")}>Live</Pill>
              <Pill small on={ev.status === "paused"} onClick={() => setStatus("paused")}>Pause</Pill>
              <Pill small on={ev.status === "done"} onClick={() => setStatus("done")}>Finish</Pill>
            </Row>
            <Body size={11} dim style={{ marginTop: 8 }}>Players can score anytime — status doesn't lock anything.</Body>
          </Card>

          {/* format settings — editable after generate */}
          <SecHead>Format settings</SecHead>
          <Card pad={14}>
            <Col gap={12}>
              <Col gap={6}>
                <Body size={12} dim bold>Format</Body>
                <Seg options={["americano", "mexicano"]} value={draft.format} onChange={(v) => setDraft({ ...draft, format: v })} />
              </Col>
              <Col gap={6}>
                <Body size={12} dim bold>Scoring</Body>
                <Seg options={["points", "ranking"]} value={draft.scoreMode} onChange={(v) => setDraft({ ...draft, scoreMode: v })} />
              </Col>
              <Col gap={6}>
                <Body size={12} dim bold>Target</Body>
                <Seg options={["race", "bestof"]} value={draft.targetMode} onChange={(v) => setDraft({ ...draft, targetMode: v })} />
              </Col>
              <Row gap={10}>
                <Col gap={6} style={{ flex: 1 }}>
                  <Body size={12} dim bold>{draft.targetMode === "bestof" ? "Best of" : "Race to"}</Body>
                  <NumInput value={draft.target} min={1} onChange={(v) => setDraft({ ...draft, target: v })} />
                </Col>
                <Col gap={6} style={{ flex: 1 }}>
                  <Body size={12} dim bold>Rounds</Body>
                  <NumInput value={draft.rounds} min={1} onChange={(v) => setDraft({ ...draft, rounds: v })} />
                </Col>
              </Row>
              <Row style={{ justifyContent: "space-between" }}>
                <Body size={12.5} bold>Fixed partner</Body>
                <Pill small on={draft.fixedPartner} onClick={() => setDraft({ ...draft, fixedPartner: !draft.fixedPartner })}>
                  {draft.fixedPartner ? "On" : "Off"}
                </Pill>
              </Row>
              <Row gap={8}>
                <Btn small full ghost onClick={saveSettings}>Save settings</Btn>
                <Btn small full danger onClick={regenerateAll}>Apply & regenerate ⚠</Btn>
              </Row>
              <Body size={11} dim>"Save settings" keeps existing matches. "Apply & regenerate" rebuilds the schedule and clears scores.</Body>
            </Col>
          </Card>

          {/* players — import names, add by hand, rename + swap in a slot */}
          <SecHead right={roster.length + " players"}>Players</SecHead>
          {Array.isArray(ev.roster) && ev.roster.length > 0 && (
            <Btn small full ghost onClick={importNames}>⬇ Import {ev.roster.length} players from reclub</Btn>
          )}
          {roster.length === 0 && <Body size={12.5} dim>No players yet — import from reclub above, or add players by name below.</Body>}
          <Col gap={7}>
            {roster.map((id) => (
              <PlayerRow key={id} id={id} name={nameOf(id)} profileName={profilesById[id]?.full_name}
                onRename={(n) => renamePlayer(id, n)}
                onRemove={lineupNames[id] !== undefined ? () => removePlayer(id) : undefined} />
            ))}
          </Col>
          <AddPlayer onAdd={addPlayer} />

          {/* rounds & matches */}
          <SecHead right={lastRound ? "round " + lastRound : "none yet"}>Schedule</SecHead>
          <Btn primary full onClick={generateNext}
            style={canGenerate ? undefined : { opacity: 0.5 }}>
            + Generate round {lastRound + 1}
          </Btn>
          {!canGenerate && (
            <Body size={11.5} dim style={{ textAlign: "center" }}>
              Finish scoring round {lastRound} first — {unscored.length} match{unscored.length > 1 ? "es" : ""} still need a final score (Mexicano seeds the next round from these results).
            </Body>
          )}
          {rounds.map((r) => {
            const rm = matches.filter((m) => m.round === r);
            return (
              <Col key={r} gap={8}>
                <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
                  <Body size={12.5} bold>Round {r}</Body>
                  <button onClick={() => clearRound(r)} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 12, cursor: "pointer" }}>clear</button>
                </Row>
                {rm.map((m, i) => (
                  <MatchRow key={m.id} m={m} cfg={draft} roster={roster} nameOf={nameOf}
                    first={i === 0} last={i === rm.length - 1}
                    onScore={score} onMove={move} onSwap={swapSlot} onSetStatus={setMatchStatus} />
                ))}
              </Col>
            );
          })}
        </Col>
        </div>
        {/* B1: live leaderboard as a side rail on desktop (host-only/internal) */}
        {wide && (
          <aside style={{ width: 340, flex: "0 0 340px", borderLeft: "1px solid var(--line)", overflowY: "auto", background: "var(--bg)" }}>
            <Col gap={12} style={{ padding: "16px 16px calc(28px + env(safe-area-inset-bottom))" }}>
              <SessionLeaderboard standings={standings} />
            </Col>
          </aside>
        )}
      </div>
    </div>
  );
}

// Live per-session leaderboard panel (B1). Same definition as the 0021
// session_leaderboard view (sum of own-side match scores, cancelled excluded).
function SessionLeaderboard({ standings }) {
  return (
    <Col gap={8}>
      <SecHead right="live ↻">Leaderboard</SecHead>
      {standings.length === 0 ? (
        <Body size={12.5} dim>No scores yet — standings appear as soon as a match is scored.</Body>
      ) : (
        <Card pad={8}>
          {standings.map((p, i) => (
            <Row key={p.id} gap={10} style={{
              padding: "8px 8px", borderRadius: 10,
              background: (i === 0 || p.me) ? "var(--accent-soft)" : "transparent",
            }}>
              <Num size={14} style={{ width: 20 }} color={p.rank <= 3 ? "var(--accent-text)" : "var(--text2)"}>{p.rank}</Num>
              <Ava ini={initialsOf(p.name)} d={26} />
              <Body size={13} bold={p.me} style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{p.me ? " (you)" : ""}</Body>
              <Num size={14}>{p.pts}</Num>
            </Row>
          ))}
        </Card>
      )}
      <Body size={10.5} dim>Sum of each player's match scores this session · cancelled matches excluded.</Body>
    </Col>
  );
}

function NumInput({ value, onChange, min = 0 }) {
  return (
    <Row gap={6}>
      <Btn small ghost onClick={() => onChange(Math.max(min, (value || 0) - 1))} style={{ minWidth: 40 }}>−</Btn>
      <Num size={18} style={{ flex: 1, textAlign: "center" }}>{value}</Num>
      <Btn small ghost onClick={() => onChange((value || 0) + 1)} style={{ minWidth: 40 }}>+</Btn>
    </Row>
  );
}

function PlayerRow({ id, name, profileName, onRename, onRemove }) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(name);
  React.useEffect(() => { setVal(name); }, [name]);
  return (
    <Card pad={10}>
      <Row gap={9}>
        <Ava ini={initialsOf(profileName || name)} d={30} />
        {editing ? (
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
            style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--text)", padding: "6px 10px", fontFamily: "var(--font-body)", fontSize: 13 }} />
        ) : (
          <Col gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Body size={13.5} bold>{name}</Body>
            {profileName && name !== firstName(profileName) && <Body size={11} dim>{profileName}</Body>}
          </Col>
        )}
        {editing
          ? <Btn small primary onClick={() => { onRename(val); setEditing(false); }}>Save</Btn>
          : <Btn small ghost onClick={() => setEditing(true)}>Rename</Btn>}
        {!editing && onRemove && (
          <button onClick={onRemove} title="Remove player"
            style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 18, cursor: "pointer", padding: "0 4px" }}>×</button>
        )}
      </Row>
    </Card>
  );
}

function AddPlayer({ onAdd }) {
  const [val, setVal] = React.useState("");
  const submit = () => { if (val.trim()) { onAdd(val); setVal(""); } };
  return (
    <Row gap={7}>
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Add player by name"
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)", padding: "10px 12px", fontFamily: "var(--font-body)", fontSize: 13, outline: "none" }} />
      <Btn small primary onClick={submit}>Add</Btn>
    </Row>
  );
}

function MatchRow({ m, cfg, roster, nameOf, first, last, onScore, onMove, onSwap, onSetStatus }) {
  const [swap, setSwap] = React.useState(null); // {team,pos}
  const complete = matchComplete({ score_a: m.score_a, score_b: m.score_b, target: m.target, targetMode: cfg.targetMode });
  const st = m.status || "live";
  const cancelled = st === "cancelled";
  const meta = MATCH_STATUS[st] || MATCH_STATUS.live;
  // auto vs host override (B2): there is no persisted "manual" flag (kept the
  // schema minimal), so we INFER it from the score. 'cancelled' is always a host
  // action, and a 'done' set before the target is reached is a manual finish.
  // Everything else (live, or done-by-score) is the normal auto state.
  const overridden = cancelled || (st === "done" && !complete);
  const slot = (team, pos, id) => (
    <button onClick={() => setSwap({ team, pos })} title="Swap player"
      style={{ background: "none", border: "none", color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline dotted", padding: 0 }}>
      {nameOf(id)}
    </button>
  );
  return (
    <Card pad={12} style={{
      borderColor: cancelled ? "var(--line)" : st === "done" ? "var(--success)" : complete ? "var(--accent)" : "var(--line)",
      borderStyle: cancelled ? "dashed" : "solid",
      opacity: cancelled ? 0.65 : 1,
    }}>
      <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <Row gap={8} style={{ minWidth: 0, alignItems: "center", flexWrap: "wrap" }}>
          <Body size={11} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{courtName(m.court)}</Body>
          <Row gap={5} style={{ alignItems: "center" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color, animation: st === "live" ? "tpPulse 1.2s infinite" : "none" }} />
            <Body size={10.5} bold>{meta.label}</Body>
            <Body size={9.5} bold dim={!overridden}
              color={overridden ? "#E6A23C" : undefined}
              style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {overridden ? "· host override" : "· auto"}
            </Body>
          </Row>
        </Row>
        <Row gap={4}>
          <Btn small ghost onClick={() => onMove(m, -1)} style={{ minWidth: 34, opacity: first ? 0.35 : 1, padding: "6px 8px" }}>↑</Btn>
          <Btn small ghost onClick={() => onMove(m, 1)} style={{ minWidth: 34, opacity: last ? 0.35 : 1, padding: "6px 8px" }}>↓</Btn>
        </Row>
      </Row>
      {[["A", m.team_a, m.score_a], ["B", m.team_b, m.score_b]].map(([team, ids, sc]) => (
        <Row key={team} style={{ justifyContent: "space-between", padding: "6px 0" }}>
          <Row gap={6} style={{ minWidth: 0, flexWrap: "wrap" }}>
            {ids.map((id, pos) => (
              <React.Fragment key={pos}>{pos > 0 && <Body size={12} dim>/</Body>}{slot(team, pos, id)}</React.Fragment>
            ))}
          </Row>
          <Row gap={6}>
            <Btn small ghost onClick={() => !cancelled && onScore(m, team, -1)} style={{ minWidth: 34, padding: "6px 8px", opacity: cancelled ? 0.4 : 1 }}>−</Btn>
            <Num size={20} style={{ minWidth: 26, textAlign: "center" }}>{sc}</Num>
            <Btn small primary onClick={() => !cancelled && onScore(m, team, 1)} style={{ minWidth: 34, padding: "6px 8px", opacity: cancelled ? 0.4 : 1 }}>+</Btn>
          </Row>
        </Row>
      ))}
      {/* B2: host-only manual status override → 0021 set_match_status RPC. The
          whole SessionManager is host-gated (manageSession), and the RPC also
          enforces host on the server, so these controls are never live for a
          non-host. */}
      <Row gap={6} style={{ marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Body size={10} dim bold style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Set status</Body>
        <Pill small on={st === "live"} onClick={() => onSetStatus(m, "live")}>Live</Pill>
        <Pill small on={st === "done"} onClick={() => onSetStatus(m, "done")}>Done</Pill>
        <Pill small on={st === "cancelled"} onClick={() => onSetStatus(m, "cancelled")}>Cancel</Pill>
      </Row>
      {cancelled && <Body size={10.5} dim style={{ marginTop: 6 }}>Cancelled by host — excluded from the leaderboard.</Body>}
      {swap && (
        <Card pad={10} style={{ marginTop: 8, background: "var(--surface2)" }}>
          <Body size={11.5} dim bold style={{ marginBottom: 7 }}>Place in {courtName(m.court)} · team {swap.team} slot {swap.pos + 1}</Body>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {roster.map((id) => (
              <Pill key={id} small onClick={() => { onSwap(m, swap.team, swap.pos, id); setSwap(null); }}>{nameOf(id)}</Pill>
            ))}
            <Pill small onClick={() => setSwap(null)}>cancel</Pill>
          </div>
        </Card>
      )}
    </Card>
  );
}
