# Launch runbook — ternakpadel.xyz

The deployed site runs in **demo mode** (simulated data, no backend) until the
Supabase env secrets are set. Follow these steps in order to go fully live.
Everything code-side is already in this repo.

## 1. Supabase project (database + auth + realtime)

1. Create a project at [supabase.com](https://supabase.com) (region: Singapore `ap-southeast-1` — closest to Jakarta).
2. Apply the schema: open **SQL Editor**, paste `supabase/migrations/0001_init.sql`, run it.
   (Or with the CLI: `supabase link --project-ref <ref> && supabase db push`.)
3. **Authentication → Providers → Phone**: enable. Leave the SMS provider unset — the hook below replaces it.

## 2. WhatsApp OTP via Fonnte

1. Create an account at [fonnte.com](https://fonnte.com), connect a WhatsApp number
   (this number is the sender), copy the **API token**.
2. Deploy the OTP function and set its secrets:
   ```bash
   supabase functions deploy send-otp-whatsapp --no-verify-jwt
   supabase secrets set FONNTE_TOKEN=<your fonnte token>
   ```
3. **Dashboard → Authentication → Hooks → Send SMS hook**: enable, choose
   **HTTPS endpoint**, point it at
   `https://<project-ref>.supabase.co/functions/v1/send-otp-whatsapp`.
   Copy the generated hook secret and:
   ```bash
   supabase secrets set SEND_SMS_HOOK_SECRET=<hook secret>
   ```

## 3. Xendit payments (QRIS / OVO / Dana / ShopeePay / VA)

1. Create an account at [xendit.co](https://xendit.co). For real money you must
   complete business activation (KYC); until then use **Test mode** keys —
   the whole flow works end-to-end with test payments.
2. **Settings → Developers → API keys**: create a secret key (Money-in, write).
3. **Settings → Developers → Webhooks → Invoices**: set the URL to
   `https://<project-ref>.supabase.co/functions/v1/xendit-webhook`
   and copy the **callback verification token**.
4. Deploy the payment functions and set secrets:
   ```bash
   supabase functions deploy create-invoice
   supabase functions deploy xendit-webhook --no-verify-jwt
   supabase secrets set XENDIT_SECRET_KEY=<xnd_...> \
                        XENDIT_CALLBACK_TOKEN=<callback token> \
                        APP_URL=https://ternakpadel.xyz
   ```

## 4. Flip the site to live mode

GitHub repo → **Settings → Secrets and variables → Actions** → add:

| Secret | Value (Supabase → Settings → API) |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the `anon` public key |

Re-run the deploy workflow (Actions → Deploy to GitHub Pages → Run workflow).
The site now requires WhatsApp login and uses the real database.

## 5. Smoke test (test mode)

1. Open https://ternakpadel.xyz → onboarding → enter your real WhatsApp number
   → you receive the OTP from your Fonnte number → complete profile.
2. Tap the FAB → create an event with a date.
3. Open the event → Join → you land on the Xendit invoice page → pay with a
   [test method](https://developers.xendit.co/api-reference/#invoices) →
   redirected back → "Payment received — you're in!" and the roster shows you.
4. In Supabase **Table editor → events**, set your event's `status` to `live`
   and insert rows into `matches` for round 1 (or use the host console's
   pairings by asking the host flow to start) → Matches tab shows live courts,
   scoring syncs across two phones in realtime.
5. Finish a match → points, rank history, badges, feed post all update.

## 6. Going to production money

- Switch the Xendit key from test to live after KYC approval, update
  `XENDIT_SECRET_KEY`, re-check the webhook URL is registered for live mode.
- QRIS/e-wallet channels must be activated per-channel in the Xendit dashboard.

## Notes & known gaps

- **Starting an event**: set `events.status = 'live'` and create round-1
  matches. The host console takes over from there (end round → auto pairings).
  A "start event" button in the host console is the next natural improvement.
- The **host console** is reachable via Settings ⚙ → "Open host console" and
  is restricted to the event creator (or profiles with `is_host = true`).
- **Comments** on feed posts are displayed as 0 — the table doesn't exist yet
  (deliberate v1 cut).
- Season rollover (1 Sep) is manual: insert a new `seasons` row with
  `is_current = true` and unset the old one.
