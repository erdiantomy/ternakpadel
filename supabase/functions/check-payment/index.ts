// POST { event_id } (authenticated) → checks Xendit API for ALL pending payments
// for this user+event and updates the DB if any one of them is PAID.
//
// Secrets: XENDIT_SECRET_KEY
// Deploy:  supabase functions deploy check-payment

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  // supabase-js sends apikey + x-client-info alongside authorization; the
  // preflight must allow them all or the browser blocks the POST.
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

    const { event_id } = await req.json();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find ALL pending payments for this user + event that have a Xendit invoice ID.
    // Must check all of them — user may have clicked PAY multiple times, creating
    // multiple invoices. The one actually paid could be any of them, not just the latest.
    const { data: pendingList } = await admin.from("payments")
      .select("id,event_id,player_id,status,external_id,method")
      .eq("event_id", event_id)
      .eq("player_id", user.id)
      .eq("status", "pending")
      .not("external_id", "is", null);

    if (!pendingList || pendingList.length === 0) {
      return Response.json({ status: "not_found" }, { headers: cors });
    }

    const authHeader = "Basic " + btoa(Deno.env.get("XENDIT_SECRET_KEY")! + ":");

    for (const pay of pendingList) {
      const xenditRes = await fetch(`https://api.xendit.co/v2/invoices/${pay.external_id}`, {
        headers: { Authorization: authHeader },
      });
      if (!xenditRes.ok) continue;

      const inv = await xenditRes.json();

      if (inv.status === "PAID") {
        await admin.from("payments").update({
          status: "paid",
          method: inv.payment_method ?? inv.payment_channel ?? pay.method ?? null,
          paid_at: inv.paid_at ?? new Date().toISOString(),
        }).eq("id", pay.id);

        await admin.from("event_players").upsert({
          event_id: pay.event_id,
          player_id: pay.player_id,
          paid: true,
          status: "paid",
        });

        const { data: ev } = await admin.from("events").select("title,venue").eq("id", pay.event_id).single();
        await admin.from("feed_posts").insert({
          author: pay.player_id,
          kind: "join",
          text: `joined ${ev?.title ?? "an event"}`,
          sub: ev?.venue ?? "",
        });

        return Response.json({ status: "paid" }, { headers: cors });
      }

      if (inv.status === "EXPIRED") {
        await admin.from("payments").update({ status: "expired" }).eq("id", pay.id);
      }
    }

    return Response.json({ status: "pending" }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});
