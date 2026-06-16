// Admin-only player provisioning for Demo Mode.
//
// Lets a superadmin create a "temporary" player from the backend and (now or
// later) attach a login email to it. Because profiles.id references
// auth.users(id), a real auth user is created up front so the profile id is
// permanent: when the person later signs in with Google or an email magic-link
// using the SAME email, Supabase links that identity to this existing user and
// they keep their id and all their points — no merge needed.
//
//   POST { action: "create",    full_name, email?, phone? } → { player_id }
//   POST { action: "set_email", player_id, email }          → { ok: true }
//
// Prereq: in Supabase Auth, enable "allow same email across providers" / link
// identities so a later Google sign-in attaches to the email-provisioned user.
//
// Deploy:  supabase functions deploy provision-player
// (uses the SUPABASE_SERVICE_ROLE_KEY secret available to edge functions)

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// pure placeholder login used when the admin hasn't supplied a real email yet;
// .invalid is reserved (RFC 2606) so it can never collide with a real inbox.
const placeholderEmail = () =>
  `demo-${crypto.randomUUID()}@demo.invalid`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // who's calling — must be an authenticated superadmin
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return Response.json({ error: "unauthenticated" }, { status: 401, headers: cors });

    const { data: prof } = await caller.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!prof?.is_admin) return Response.json({ error: "admins only" }, { status: 403, headers: cors });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const action = body.action ?? "create";

    if (action === "set_email") {
      const player_id = String(body.player_id ?? "");
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!player_id) return Response.json({ error: "player_id required" }, { status: 400, headers: cors });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return Response.json({ error: "invalid email" }, { status: 400, headers: cors });
      }
      const { error } = await admin.auth.admin.updateUserById(player_id, {
        email, email_confirm: true,
      });
      if (error) return Response.json({ error: error.message }, { status: 400, headers: cors });
      return Response.json({ ok: true }, { headers: cors });
    }

    // action === "create"
    const fullName = String(body.full_name ?? "").trim();
    if (!fullName) return Response.json({ error: "full_name required" }, { status: 400, headers: cors });
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ error: "invalid email" }, { status: 400, headers: cors });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: email || placeholderEmail(),
      phone: phone || undefined,
      email_confirm: true,
      user_metadata: { full_name: fullName, demo_provisioned: true },
    });
    if (createErr || !created?.user) {
      return Response.json({ error: createErr?.message ?? "create failed" }, { status: 400, headers: cors });
    }

    // the on_auth_user_created trigger already inserted the profile row; fill in
    // the display fields the admin typed (service role bypasses RLS).
    const { error: profErr } = await admin.from("profiles")
      .update({ full_name: fullName, ...(phone ? { phone } : {}) })
      .eq("id", created.user.id);
    if (profErr) return Response.json({ error: profErr.message }, { status: 400, headers: cors });

    return Response.json({ player_id: created.user.id }, { headers: cors });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors });
  }
});
