// Fonnte incoming webhook → handles WhatsApp messages/events Fonnte forwards.
//
// Fonnte does NOT sign requests, so we gate on a shared secret in the URL:
//   https://<ref>.supabase.co/functions/v1/fonnte-webhook?secret=<FONNTE_WEBHOOK_SECRET>
// Set that URL in fonnte.com → Device → Webhook (incoming message URL).
//
// Secrets: FONNTE_WEBHOOK_SECRET (any random string, must match the ?secret= in the URL)
//          FONNTE_TOKEN          (already set — used here only if you auto-reply)
// Deploy:  supabase functions deploy fonnte-webhook --no-verify-jwt
//          (or via the dashboard editor with "Verify JWT" turned OFF)

const TOKEN = Deno.env.get("FONNTE_TOKEN");
const SECRET = Deno.env.get("FONNTE_WEBHOOK_SECRET");

// Fonnte posts either x-www-form-urlencoded / multipart OR json depending on setup.
async function parsePayload(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) return await req.json();
    const form = await req.formData();
    const obj: Record<string, string> = {};
    for (const [k, v] of form.entries()) obj[k] = typeof v === "string" ? v : "";
    return obj;
  } catch {
    return {};
  }
}

// Send a WhatsApp reply back through Fonnte.
async function reply(target: string, message: string): Promise<void> {
  if (!TOKEN) return;
  await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ target: target.replace(/^\+/, ""), message }),
  });
}

Deno.serve(async (req) => {
  // Health check / Fonnte's "test" GET.
  if (req.method !== "POST") return new Response("fonnte-webhook ok");

  // Auth: require the shared secret in the query string.
  const url = new URL(req.url);
  if (SECRET && url.searchParams.get("secret") !== SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const p = await parsePayload(req);
  const sender = (p.sender ?? "").toString();   // who messaged us (62...)
  const name = (p.name ?? "").toString();       // their WhatsApp name
  const message = (p.message ?? "").toString().trim();
  const device = (p.device ?? "").toString();   // your connected sender number

  console.log("fonnte in:", JSON.stringify({ device, sender, name, message }));

  // ───────────────────────── your logic goes here ─────────────────────────
  // Example auto-reply — uncomment and adapt:
  // if (/^(menu|halo|hi|daftar)$/i.test(message)) {
  //   await reply(sender, `Halo ${name || "kak"}! 🎾\nBalas:\n• JADWAL — lihat turnamen\n• DAFTAR — gabung`);
  // }
  // ─────────────────────────────────────────────────────────────────────────

  // Always 200 fast so Fonnte doesn't retry/queue.
  return Response.json({ ok: true });
});
