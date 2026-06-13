// Supabase Auth "Send SMS" hook → delivers the OTP via Fonnte (WhatsApp).
//
// Configure: Dashboard → Authentication → Hooks → Send SMS hook → this function.
// Secrets:   FONNTE_TOKEN (fonnte.com dashboard), SEND_SMS_HOOK_SECRET
//            (the hook secret Supabase shows when you enable the hook,
//             without the "v1,whsec_" prefix it is base64).
// Deploy:    supabase functions deploy send-otp-whatsapp --no-verify-jwt

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

Deno.serve(async (req) => {
  const payload = await req.text();

  // verify the request really comes from Supabase Auth
  const secret = Deno.env.get("SEND_SMS_HOOK_SECRET")!.replace("v1,whsec_", "");
  const wh = new Webhook(secret);
  let data: { user: { phone: string }; sms: { otp: string } };
  try {
    data = wh.verify(payload, {
      "webhook-id": req.headers.get("webhook-id")!,
      "webhook-timestamp": req.headers.get("webhook-timestamp")!,
      "webhook-signature": req.headers.get("webhook-signature")!,
    }) as typeof data;
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: Deno.env.get("FONNTE_TOKEN")!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: data.user.phone,
      message:
        `🎾 *Ternak Padel*\n\nKode masuk kamu: *${data.sms.otp}*\n\n` +
        `Berlaku 5 menit. Jangan bagikan kode ini ke siapa pun.`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("fonnte error:", err);
    return Response.json(
      { error: { http_code: res.status, message: "WhatsApp delivery failed" } },
      { status: 500 },
    );
  }
  return Response.json({});
});
