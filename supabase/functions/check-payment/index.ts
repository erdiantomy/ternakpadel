// POST { event_id } (authenticated) → checks Xendit API for the latest pending payment
// and updates the DB if Xendit reports PAID.
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

    // Find the latest pending payment for this user + event
    const { data: pay } = await admin.from("payments")
      .select("id,event_id,player_id,status,external_id,method")
      .eq("event_id", event_id)
      .eq("player_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pay) return Response.json({ status: "not_found" }, { headers: cors });
    if (!pay.external_id) return Response.json({ status: pay.status }, { headers: cors });

    // Call Xendit API to get current invoice status
    const xenditRes = await fetch(`https://api.xendit.co/v2/invoices/${pay.external_id}`, {
      headers: {
        Authorization: "Basic " + btoa(Deno.env.get("XENDIT_SECRET_KEY")! + ":"),
      },
    });

    if (!xenditRes.ok) {
      return Response.json({ status: pay.status }, { headers: cors });
    }

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
      return Response.json({ status: "expired" }, { headers: cors });
    }

    return Response.json({ status: "pending" }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});
