// Xendit invoice callback. Configure in the Xendit dashboard:
//   Settings → Webhooks → Invoices →
//   https://<project-ref>.supabase.co/functions/v1/xendit-webhook
//
// Secrets: XENDIT_CALLBACK_TOKEN (from the same dashboard page)
// Deploy:  supabase functions deploy xendit-webhook --no-verify-jwt

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.headers.get("x-callback-token") !== Deno.env.get("XENDIT_CALLBACK_TOKEN")) {
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.json(); // { external_id, status, payment_method, paid_at, ... }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: pay } = await admin.from("payments")
    .select("id,event_id,player_id,status").eq("id", body.external_id).single();
  if (!pay) return new Response("unknown payment", { status: 200 }); // ack, don't retry

  if (body.status === "PAID" && pay.status !== "paid") {
    await admin.from("payments").update({
      status: "paid",
      method: body.payment_method ?? body.payment_channel ?? null,
      paid_at: body.paid_at ?? new Date().toISOString(),
    }).eq("id", pay.id);

    await admin.from("event_players").upsert({
      event_id: pay.event_id, player_id: pay.player_id, paid: true,
    });

    const { data: ev } = await admin.from("events").select("title,venue").eq("id", pay.event_id).single();
    await admin.from("feed_posts").insert({
      author: pay.player_id, kind: "join",
      text: `joined ${ev?.title ?? "an event"}`,
      sub: ev?.venue ?? "",
    });
  } else if (body.status === "EXPIRED") {
    await admin.from("payments").update({ status: "expired" }).eq("id", pay.id);
  }

  return new Response("ok", { status: 200 });
});
