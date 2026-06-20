// Session format engine — pure helpers, no React / Supabase.
// Drives the organizer's self-service live session: pairings, scoring target
// and standings, all derived from a per-event `config` (see 0014 migration).

export const FORMATS = ["americano", "mexicano"];
export const SCORE_MODES = ["points", "ranking"];
export const TARGET_MODES = ["race", "bestof"];

// Normalize an event's config, filling defaults from the legacy `type` label so
// pre-existing events keep working without a config row.
export function sessionConfig(ev) {
  const c = (ev && ev.config) || {};
  const typeLc = (ev?.type || "").toLowerCase();
  return {
    format: FORMATS.includes(c.format) ? c.format : (typeLc.includes("mexicano") ? "mexicano" : "americano"),
    fixedPartner: typeof c.fixedPartner === "boolean" ? c.fixedPartner : false,
    scoreMode: SCORE_MODES.includes(c.scoreMode) ? c.scoreMode : "points",
    rounds: Number.isFinite(c.rounds) && c.rounds > 0 ? c.rounds : 7,
    targetMode: TARGET_MODES.includes(c.targetMode) ? c.targetMode : "race",
    target: Number.isFinite(c.target) && c.target > 0 ? c.target : 21,
    courts: Number.isFinite(c.courts) && c.courts > 0 ? c.courts : (ev?.courts || 4),
  };
}

// Pair an ordered list of player ids into courts of 4.
//   fixedPartner → (p0,p1) vs (p2,p3): partners stay together
//   otherwise    → (p0,p3) vs (p1,p2): balanced (strong+weak vs mid pair)
// The ORDER of `ids` carries the seeding: round 1 = roster order, later rounds =
// standings order (mexicano) or a rotation (americano). Returns { courts, resting }.
export function pairCourts(ids, { fixedPartner } = {}) {
  const courts = [];
  let i = 0;
  for (; i + 3 < ids.length; i += 4) {
    const g = ids.slice(i, i + 4);
    courts.push(fixedPartner
      ? { team_a: [g[0], g[1]], team_b: [g[2], g[3]] }
      : { team_a: [g[0], g[3]], team_b: [g[1], g[2]] });
  }
  return { courts, resting: ids.slice(i) };
}

// Order the players for a given round.
//   round 1            → roster order (`baseIds`)
//   mexicano           → re-seed by current standings each round
//   americano          → rotate the roster so partners/opponents vary
export function orderForRound(baseIds, standingsIds, { format }, round) {
  if (round <= 1 || !standingsIds || standingsIds.length === 0) return baseIds.slice();
  if (format === "mexicano") {
    // sort by standings, append anyone missing (rested players keep their slot)
    const rank = new Map(standingsIds.map((id, idx) => [id, idx]));
    return baseIds.slice().sort((a, b) =>
      (rank.has(a) ? rank.get(a) : 1e9) - (rank.has(b) ? rank.get(b) : 1e9));
  }
  // americano: rotate by (round-1) so groupings change each round
  const n = baseIds.length;
  if (n === 0) return [];
  const shift = ((round - 1) % n + n) % n;
  return baseIds.slice(shift).concat(baseIds.slice(0, shift));
}

// Build the next round's court assignments end-to-end.
export function buildRound({ baseIds, standingsIds, config, round, nameOf }) {
  const ordered = orderForRound(baseIds, standingsIds, config, round);
  const { courts, resting } = pairCourts(ordered, config);
  const named = courts.map((c, idx) => ({
    ...c,
    court: idx + 1,
    order_index: idx + 1,
    team_a_names: c.team_a.map(nameOf).join(" / "),
    team_b_names: c.team_b.map(nameOf).join(" / "),
  }));
  return { courts: named, resting };
}

// A match is "complete" given the session target rules.
export function matchComplete({ score_a, score_b, target, targetMode }) {
  if (targetMode === "bestof") return (score_a + score_b) >= target;
  return score_a >= target || score_b >= target; // race
}
