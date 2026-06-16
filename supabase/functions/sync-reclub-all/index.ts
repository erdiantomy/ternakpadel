// Nightly auto-sync: re-import every OPEN, future reclub-sourced event from its
// source link. Triggered by pg_cron (x-cron-secret header) or manually by an
// admin (Authorization bearer). Preserves each event's status; only refreshes
// the descriptive fields. No reclub API — decodes the public Nuxt payload.
//
// Deploy: supabase functions deploy sync-reclub-all --no-verify-jwt

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PASS = new Set(["Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef", "EmptyShallowRef", "Raw"]);
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
function mapType(s: string): string | undefined {
  const t = (s || "").toLowerCase();
  for (const ty of ["Mexicano", "Mixicano", "Americano", "King of the Hill", "Knockout", "League"])
    if (t.includes(ty.toLowerCase())) return ty;
  if (t.includes("koth")) return "King of the Hill";
  if (t.includes("marathon")) return "Americano";
  return undefined;
}
function parseCaption(text: string) {
  const t = (text || "").replace(/ /g, " ");
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
  let title = t.replace(/[^\x00-\x7F]+/g, " ").replace(/\b\d+\s*[ch]\b/gi, " ").replace(/\b\d+\s*pair\b/gi, " ")
    .replace(/win[^]*?prize[^]*?[\d.,]+/i, " ").replace(/(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?[^]*$/i, " ")
    .replace(/[|!·*]+/g, " ").replace(/\s+/g, " ").trim();
  out.title = title.split(" ").slice(0, 7).join(" ") || "Padel Session";
  return out;
}

async function fetchEvent(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error("reclub " + res.status);
  const html = await res.text();
  const titleTag = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").replace(/^reclub\s*/i, "").trim();
  let meet: any = null;
  const nm = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nm) { try { meet = findMeet(unflatten(JSON.parse(nm[1]))); } catch (_) { /* fall back */ } }
  const caption = (meet?.name || titleTag || "").toString();
  const out: any = parseCaption(caption);
  const bits: string[] = [];
  if (meet) {
    if (typeof meet.startDatetime === "number") out.starts_iso = new Date(meet.startDatetime * 1000).toISOString();
    if (typeof meet.duration === "number") bits.push(Math.round(meet.duration / 3600) + " hours");
    if (typeof meet.feeAmount === "number" && meet.feeAmount > 0) out.fee = meet.feeAmount;
    if (typeof meet.numPlayers === "number" && meet.numPlayers > 0) out.max = meet.numPlayers;
    const venueName = meet?.venue?.name || meet?.location?.name;
    if (venueName) out.venue = /toms/i.test(venueName) ? "TOMS PADEL" : String(venueName);
    const fmt = meet?.sportFormat?.name;
    if (fmt) out.type = mapType(String(fmt)) || out.type;
    if (meet.isCancelled === true) out.cancelled = true;
  }
  const prize = (caption.match(/(?:prize|cash)[^\d]*([\d.,]{5,})/i) || [])[1];
  if (prize) bits.unshift("Prize Rp " + prize);
  out.desc = bits.join(" · ");
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ---- authorize: cron secret (pg_cron) OR an admin user ----
    let authed = false;
    const cronHeader = req.headers.get("x-cron-secret");
    if (cronHeader) {
      const { data } = await admin.from("app_config").select("value").eq("key", "cron_secret").maybeSingle();
      if (data?.value && cronHeader === data.value) authed = true;
    }
    if (!authed) {
      const authz = req.headers.get("Authorization");
      if (authz) {
        const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authz } } });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
          if (prof?.is_admin) authed = true;
        }
      }
    }
    if (!authed) return Response.json({ error: "unauthorized" }, { status: 401, headers: cors });

    // ---- only open, future reclub events ----
    const { data: events } = await admin.from("events")
      .select("id,source_url,status,title,type,venue,fee,courts,max_players,description,starts_at")
      .eq("source", "reclub").eq("status", "open").gt("starts_at", new Date().toISOString());

    let synced = 0, failed = 0, cancelled = 0;
    const errors: string[] = [];
    for (const e of events ?? []) {
      if (!e.source_url) continue;
      try {
        const d = await fetchEvent(e.source_url);
        const upd: any = {
          title: d.title || e.title, type: d.type || e.type, venue: d.venue || e.venue,
          fee: typeof d.fee === "number" ? d.fee : e.fee,
          courts: d.courts || e.courts, max_players: d.max || e.max_players,
          description: d.desc ?? e.description,
        };
        if (d.starts_iso) upd.starts_at = d.starts_iso;
        if (d.cancelled) { upd.status = "cancelled"; cancelled++; }
        await admin.from("events").update(upd).eq("id", e.id);
        synced++;
      } catch (err) { failed++; if (errors.length < 5) errors.push(String(err)); }
    }
    return Response.json({ ok: true, scanned: (events ?? []).length, synced, cancelled, failed, errors }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});
