// POST { url } (authenticated) → fetches a reclub event page, decodes the Nuxt
// SSR payload, and returns normalized fields for the admin to review & create.
// No reclub API is used — only the public page. SSRF-guarded to reclub.co.
//
// Deploy: supabase functions deploy import-reclub

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Strip lone UTF-16 surrogates + control chars so values stay valid JSON when the
// client inserts them (PostgREST rejects unpaired surrogate escapes → PGRST102
// "Empty or invalid json"). Reclub names/notes routinely carry emoji.
const clean = (s: unknown): string =>
  String(s ?? "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")   // lone high surrogate
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")   // lone low surrogate
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); // control chars (keep \n, \t)

// ---- minimal Nuxt/devalue unflattener -------------------------------------
// Nuxt serializes SSR state as a flat array where object/array members are
// indices into the array, and reactive wrappers are ["Reactive", idx] tags.
const PASS = new Set(["Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef", "EmptyShallowRef", "Raw", "Reactive"]);
function unflatten(arr: any[]): any {
  const out = new Array(arr.length);
  const seen = new Array(arr.length).fill(false);
  function hydrate(i: any): any {
    if (typeof i !== "number") return i;
    if (i < 0) return undefined;
    if (seen[i]) return out[i];
    const v = arr[i];
    if (v === null || typeof v !== "object") { seen[i] = true; out[i] = v; return v; }
    if (Array.isArray(v)) {
      if (typeof v[0] === "string") {
        if (PASS.has(v[0])) { seen[i] = true; const r = hydrate(v[1]); out[i] = r; return r; }
        if (v[0] === "Date") { seen[i] = true; out[i] = new Date(v[1]); return out[i]; }
      }
      const a: any[] = []; seen[i] = true; out[i] = a;
      for (const e of v) a.push(hydrate(e));
      return a;
    }
    const o: any = {}; seen[i] = true; out[i] = o;
    for (const k in v) o[k] = hydrate(v[k]);
    return o;
  }
  return hydrate(0);
}

function findMeet(node: any, depth = 0): any {
  if (!node || typeof node !== "object" || depth > 9) return null;
  if (!Array.isArray(node) && "startDatetime" in node && "referenceCode" in node) return node;
  for (const k in node) { const r = findMeet((node as any)[k], depth + 1); if (r) return r; }
  return null;
}

// the wrapper object carries both the meet and the usersMap (userId → user)
function findWrap(node: any, depth = 0, seen = new Set()): any {
  if (!node || typeof node !== "object" || depth > 10 || seen.has(node)) return null;
  seen.add(node);
  if (!Array.isArray(node) && (node as any).meet && (node as any).usersMap) return node;
  for (const k in node) { const r = findWrap((node as any)[k], depth + 1, seen); if (r) return r; }
  return null;
}

// confirmed participants (reclub participation status === 1), resolved to display names
function confirmedPlayers(meet: any, usersMap: any): string[] {
  if (!meet || !Array.isArray(meet.participants) || !usersMap) return [];
  const out: string[] = [];
  for (const p of meet.participants) {
    if (!p || p.status !== 1) continue; // 0=organizer, 1=confirmed, 2=waitlist, 3=invited
    const u = usersMap[p.referenceId] || usersMap[String(p.referenceId)] || {};
    const nm = clean(u.name || u.username || "").trim();
    if (nm) out.push(nm);
  }
  return out;
}

function mapType(s: string): string | undefined {
  const t = (s || "").toLowerCase();
  for (const ty of ["Mexicano", "Mixicano", "Americano", "King of the Hill", "Knockout", "League"])
    if (t.includes(ty.toLowerCase())) return ty;
  if (t.includes("koth")) return "King of the Hill";
  if (t.includes("marathon")) return "Americano";
  return undefined;
}

// fuzzy text parse (fallback / fills courts & title that aren't clean fields)
function parseCaption(text: string) {
  const t = (text || "").replace(/ /g, " ");
  const lc = t.toLowerCase();
  const out: any = {};
  const courts = (lc.match(/(\d+)\s*c\b/) || lc.match(/(\d+)\s*courts?/) || [])[1];
  if (courts) out.courts = Math.min(8, +courts);
  const players = (lc.match(/(\d+)\s*(?:players?|pax)/) || [])[1];
  const pairs = (lc.match(/(\d+)\s*pair/) || [])[1];
  if (players) out.max = +players; else if (pairs) out.max = Math.min(64, +pairs * 2);
  out.type = mapType(t) || "Americano";
  const vm = t.match(/📍\s*([^\n📍⏰🏆🔥💸🏃]+)/);
  if (vm) { const v = vm[1].trim().replace(/\s+/g, " "); if (v) out.venue = /toms/i.test(v) ? "TOMS PADEL" : v; }
  let title = t
    .replace(/[^\x00-\x7F]+/g, " ")
    .replace(/\b\d+\s*[ch]\b/gi, " ")
    .replace(/\b\d+\s*pair\b/gi, " ")
    .replace(/win[^]*?prize[^]*?[\d.,]+/i, " ")
    .replace(/(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?[^]*$/i, " ")
    .replace(/[|!·*]+/g, " ")
    .replace(/\s+/g, " ").trim();
  out.title = title.split(" ").slice(0, 7).join(" ") || "Padel Session";
  return out;
}

function jakartaInput(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "unauthenticated" }, { status: 401, headers: cors });

    const { url } = await req.json();
    let u: URL;
    try { u = new URL(url); } catch { return Response.json({ error: "invalid url" }, { status: 400, headers: cors }); }
    // SSRF guard: only public reclub.co links
    if (u.protocol !== "https:" || !/(^|\.)reclub\.co$/i.test(u.hostname)) {
      return Response.json({ error: "only https reclub.co links are supported" }, { status: 400, headers: cors });
    }

    const res = await fetch(u.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return Response.json({ error: `reclub returned ${res.status}` }, { status: 502, headers: cors });
    const html = await res.text();

    const titleTag = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").replace(/^reclub\s*/i, "").trim();

    let meet: any = null;
    let players: string[] = [];
    const nm = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nm) {
      try {
        const root = unflatten(JSON.parse(nm[1]));
        const wrap = findWrap(root);
        meet = wrap?.meet || findMeet(root);
        if (wrap?.meet) players = confirmedPlayers(wrap.meet, wrap.usersMap);
      } catch (_) { /* fall back to caption */ }
    }

    const caption = (meet?.name || titleTag || "").toString();
    const out = parseCaption(caption);
    out.source = "reclub";
    out.source_url = u.toString();
    out.desc = "";
    out.players = players;          // confirmed participant display names
    out.confirmed = players.length; // e.g. 3 (of max)
    const bits: string[] = [];

    if (meet) {
      if (meet.referenceCode) out.source_ref = String(meet.referenceCode);
      if (typeof meet.startDatetime === "number") out.when = jakartaInput(meet.startDatetime);
      if (typeof meet.duration === "number") bits.push(Math.round(meet.duration / 3600) + " hours");
      if (typeof meet.feeAmount === "number" && meet.feeAmount > 0) out.fee = meet.feeAmount;
      if (typeof meet.numPlayers === "number" && meet.numPlayers > 0) out.max = meet.numPlayers;
      const venueName = meet?.venue?.name || meet?.location?.name;
      if (venueName) out.venue = /toms/i.test(venueName) ? "TOMS PADEL" : clean(venueName);
      const fmt = meet?.sportFormat?.name;
      if (fmt) out.type = mapType(String(fmt)) || out.type;
      if (meet.notes && typeof meet.notes === "string" && meet.notes.trim()) bits.unshift(clean(meet.notes.trim().slice(0, 140)));
    }
    // pull a prize line from the caption for the description
    const prize = (caption.match(/(?:prize|cash)[^\d]*([\d.,]{5,})/i) || [])[1];
    if (prize) bits.unshift("Prize Rp " + prize);
    out.desc = clean(bits.join(" · "));

    return Response.json({ ok: true, parsed_from: meet ? "nuxt" : "caption", ...out }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});
