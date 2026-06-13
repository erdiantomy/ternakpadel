#!/usr/bin/env bash
# One-shot backend bring-up for Ternak Padel.
# Does everything that needs Supabase: schema, function secrets, edge-function
# deploys, and the WhatsApp OTP auth hook. Run it once, locally, and walk away.
#
# This file contains NO secrets — it reads them from the environment so it is
# safe to commit. Provide them inline when you run it (see the chat handoff).
#
# Required env vars:
#   SUPABASE_ACCESS_TOKEN   personal token: https://supabase.com/dashboard/account/tokens
#   FONNTE_TOKEN            Fonnte WhatsApp API token
#   XENDIT_SECRET_KEY       Xendit secret key (xnd_...)
#   XENDIT_CALLBACK_TOKEN   Xendit webhook verification token
# Optional:
#   PROJECT_REF            default: qsgwtjcrgedjbjsbibxr
#   APP_URL                default: https://ternakpadel.xyz
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=...  FONNTE_TOKEN=...  XENDIT_SECRET_KEY=...  XENDIT_CALLBACK_TOKEN=...
#   bash scripts/setup-backend.sh

set -euo pipefail

PROJECT_REF="${PROJECT_REF:-qsgwtjcrgedjbjsbibxr}"
APP_URL="${APP_URL:-https://ternakpadel.xyz}"
API="https://api.supabase.com/v1/projects/${PROJECT_REF}"
HOOK_URL="https://${PROJECT_REF}.supabase.co/functions/v1/send-otp-whatsapp"
WEBHOOK_URL="https://${PROJECT_REF}.supabase.co/functions/v1/xendit-webhook"

# fail early if a required secret is missing
for v in SUPABASE_ACCESS_TOKEN FONNTE_TOKEN XENDIT_SECRET_KEY XENDIT_CALLBACK_TOKEN; do
  if [ -z "${!v:-}" ]; then echo "✗ missing required env var: $v" >&2; exit 1; fi
done
cd "$(dirname "$0")/.."   # repo root

echo "▶ Ternak Padel backend setup — project ${PROJECT_REF}"

# ── 0. Supabase CLI ─────────────────────────────────────────────────────────
if ! command -v supabase >/dev/null 2>&1; then
  echo "  installing supabase CLI…"
  npm i -g supabase >/dev/null 2>&1 || { curl -fsSL https://supabase.com/install.sh | sh; export PATH="$HOME/.local/bin:$PATH"; }
fi
export SUPABASE_ACCESS_TOKEN

# ── 1. Schema (Management API SQL endpoint — no DB password needed) ──────────
echo "  applying database schema…"
python3 - "$PROJECT_REF" <<'PY'
import json, os, sys, urllib.request, urllib.error
ref = sys.argv[1]; tok = os.environ["SUPABASE_ACCESS_TOKEN"]
sql = open("supabase/migrations/0001_init.sql").read()
req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/database/query",
    data=json.dumps({"query": sql}).encode(), method="POST",
    headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
try:
    r = urllib.request.urlopen(req); print("    ✓ schema applied (HTTP %d)" % r.status)
except urllib.error.HTTPError as e:
    body = e.read().decode()
    if "already exists" in body:
        print("    ✓ schema already present — skipping")
    else:
        print("    ✗ schema error %d: %s" % (e.code, body[:400])); sys.exit(1)
PY

# ── 2. Edge-function secrets ────────────────────────────────────────────────
echo "  setting function secrets…"
supabase secrets set --project-ref "$PROJECT_REF" \
  FONNTE_TOKEN="$FONNTE_TOKEN" \
  XENDIT_SECRET_KEY="$XENDIT_SECRET_KEY" \
  XENDIT_CALLBACK_TOKEN="$XENDIT_CALLBACK_TOKEN" \
  APP_URL="$APP_URL" >/dev/null
echo "    ✓ FONNTE_TOKEN, XENDIT_SECRET_KEY, XENDIT_CALLBACK_TOKEN, APP_URL"

# ── 3. Deploy edge functions ────────────────────────────────────────────────
echo "  deploying edge functions…"
supabase functions deploy create-invoice      --project-ref "$PROJECT_REF"
supabase functions deploy xendit-webhook      --project-ref "$PROJECT_REF" --no-verify-jwt
supabase functions deploy send-otp-whatsapp   --project-ref "$PROJECT_REF" --no-verify-jwt

# ── 4. Auth: enable phone + WhatsApp Send-SMS hook (self-generated secret) ───
echo "  configuring phone auth + WhatsApp OTP hook…"
HOOK_SECRET="v1,whsec_$(openssl rand -base64 24 | tr -d '\n')"
supabase secrets set --project-ref "$PROJECT_REF" SEND_SMS_HOOK_SECRET="$HOOK_SECRET" >/dev/null
HTTP=$(curl -sS -o /tmp/tp_auth.json -w "%{http_code}" -X PATCH "${API}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" -H "Content-Type: application/json" \
  -d "{\"external_phone_enabled\": true, \"hook_send_sms_enabled\": true, \"hook_send_sms_uri\": \"${HOOK_URL}\", \"hook_send_sms_secrets\": \"${HOOK_SECRET}\"}")
if [ "$HTTP" = "200" ]; then
  echo "    ✓ phone auth + OTP hook wired automatically"
else
  echo "    ⚠ auth API returned HTTP ${HTTP} ($(head -c160 /tmp/tp_auth.json))"
  echo "      Do this once in the dashboard instead:"
  echo "        Authentication → Providers → Phone: enable (leave SMS provider blank)"
  echo "        Authentication → Hooks → Send SMS hook → HTTPS → ${HOOK_URL}"
  echo "      The hook secret is already set in function secrets (SEND_SMS_HOOK_SECRET);"
  echo "      if the dashboard generates its own, copy it and run:"
  echo "        supabase secrets set --project-ref ${PROJECT_REF} SEND_SMS_HOOK_SECRET=<that secret>"
fi

# ── 5. The one thing with no API: Xendit webhook URL ────────────────────────
cat <<EOF

✅ Supabase backend is up.

ONE manual field left (Xendit has no public API for this):
  Xendit Dashboard → Settings → Developers → Webhooks → Invoices
    URL: ${WEBHOOK_URL}
    Verification token must equal your XENDIT_CALLBACK_TOKEN.

Then reply "backend is up" and the live frontend deploy will be triggered.
EOF
