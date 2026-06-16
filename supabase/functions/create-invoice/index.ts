// POST { event_id } (authenticated) → creates a Xendit invoice for the event
// fee, records a pending payment, returns { invoice_url } for redirect.
//
// Secrets: XENDIT_SECRET_KEY, APP_URL (e.g. https://ternakpadel.xyz)
// Deploy:  supabase functions deploy create-invoice

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  // supabase-js sends apikey + x-client-info alongside authorization; the
  // preflight must allow them all or the browser blocks the POST (only the
  // OPTIONS shows up in logs and the user sees "payment setup failed").
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
    const { data: ev, error: evErr } = await supabase
      .from("events").select("id,title,fee,max_players,status").eq("id", event_id).single();
    if (evErr || !ev) return Response.json({ error: "event not found" }, { status: 404, headers: cors });
    if (ev.status !== "open") return Response.json({ error: "registration closed" }, { status: 409, headers: cors });

    // Gate: only an APPROVED join-request may pay. The host/admin approves first.
    const { data: me } = await supabase.from("event_players")
      .select("status").eq("event_id", event_id).eq("player_id", user.id).maybeSingle();
    if (!me) return Response.json({ error: "request to join first" }, { status: 403, headers: cors });
    if (me.status === "paid") return Response.json({ error: "you're already in" }, { status: 409, headers: cors });
    if (me.status !== "approved") {
      return Response.json({ error: "your request hasn't been approved yet" }, { status: 403, headers: cors });
    }

    const { count } = await supabase.from("event_players")
      .select("*", { count: "exact", head: true }).eq("event_id", event_id).eq("paid", true);
    if ((count ?? 0) >= ev.max_players) {
      return Response.json({ error: "event full" }, { status: 409, headers: cors });
    }

    // service role for payment bookkeeping (payments table has no client write policies)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Reuse existing pending invoice if one exists — prevents duplicate invoices
    // when user clicks PAY more than once before completing payment.
    const { data: existing } = await admin.from("payments")
      .select("id,invoice_url,external_id")
      .eq("event_id", event_id)
      .eq("player_id", user.id)
      .eq("status", "pending")
      .not("external_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.invoice_url) {
      return Response.json({ invoice_url: existing.invoice_url, payment_id: existing.id }, { headers: cors });
    }

    const { data: pay, error: payErr } = await admin.from("payments")
      .insert({ event_id, player_id: user.id, amount: ev.fee })
      .select().single();
    if (payErr) throw payErr;

    const appUrl = Deno.env.get("APP_URL") ?? "https://ternakpadel.xyz";
    const res = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(Deno.env.get("XENDIT_SECRET_KEY")! + ":"),
      },
      body: JSON.stringify({
        external_id: pay.id,
        amount: ev.fee,
        description: `Ternak Padel — ${ev.title}`,
        currency: "IDR",
        success_redirect_url: `${appUrl}/?paid=${event_id}`,
        failure_redirect_url: `${appUrl}/?payfail=${event_id}`,
        // Don't pin payment_methods: in production Xendit rejects the whole
        // invoice if any listed channel isn't activated on the account. Omitting
        // it makes Xendit offer exactly the channels you've activated (QRIS,
        // e-wallets, VA, etc.) — activate more in Settings → Channels.
      }),
    });
    const inv = await res.json();
    if (!res.ok) {
      await admin.from("payments").update({ status: "failed" }).eq("id", pay.id);
      return Response.json({ error: inv.message ?? "xendit error" }, { status: 502, headers: cors });
    }

    await admin.from("payments")
      .update({ external_id: inv.id, invoice_url: inv.invoice_url })
      .eq("id", pay.id);

    return Response.json({ invoice_url: inv.invoice_url, payment_id: pay.id }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});
