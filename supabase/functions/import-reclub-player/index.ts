// POST { url } (authenticated) → validates a reclub player link and returns the
// public display name + handle. NOTE: reclub gates the rich profile (bio/avatar/
// IG/stats) behind its own auth (the player API returns 401 and the data is not
// in the public page), so only the public name/handle can be synced without a
// reclub API token. SSRF-guarded to reclub.co.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    let { url } = await req.json();
    // allow pasting a bare handle like "@tomthepadel" or "tomthepadel"
    if (url && !/^https?:/i.test(url)) url = `https://reclub.co/players/@${url.replace(/^@/, "")}`;
    let u: URL;
    try { u = new URL(url); } catch { return Response.json({ error: "invalid url" }, { status: 400, headers: cors }); }
    if (u.protocol !== "https:" || !/(^|\.)reclub\.co$/i.test(u.hostname) || !/\/players\//i.test(u.pathname)) {
      return Response.json({ error: "use a reclub player link, e.g. https://reclub.co/players/@handle" }, { status: 400, headers: cors });
    }

    const res = await fetch(u.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (res.status === 404) return Response.json({ error: "no reclub player found at that link" }, { status: 404, headers: cors });
    if (!res.ok) return Response.json({ error: `reclub returned ${res.status}` }, { status: 502, headers: cors });
    const html = await res.text();

    // public page only exposes "<title>NAME (@handle)</title>"
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").trim();
    const m = title.match(/^(.*?)\s*\(@([^)]+)\)\s*$/);
    const handleFromUrl = decodeURIComponent(u.pathname.split("/").pop() || "").replace(/^@/, "");
    const handle = (m?.[2] || handleFromUrl || "").trim();
    const name = (m?.[1] || "").trim();
    if (!handle) return Response.json({ error: "couldn't read that reclub profile" }, { status: 422, headers: cors });

    return Response.json({
      ok: true,
      name: name || null,
      handle,
      reclub_url: `https://reclub.co/players/@${handle}`,
      // honest about scope: reclub keeps the rest behind auth
      note: "Synced public name & handle. reclub keeps bio/photo/IG private to its API.",
    }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});
