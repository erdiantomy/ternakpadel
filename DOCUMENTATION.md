# Ternak Padel — Operations & User Guide

Everything you need to run, administer, and use the app: URLs, accounts, roles,
and step-by-step flows from admin down to players.

> **Security note on credentials.** This file lives in a GitHub repo, so it does
> **not** contain secret values (API keys, client secrets, tokens). It lists the
> **name and storage location** of every credential plus a link to view/rotate
> it. Public identifiers (site URL, project ref, the publishable anon key — which
> is designed to be exposed in the browser) are included in full.

---

## 1. What this is

A padel community + matchmaking PWA. Players sign in with Google, set up a
profile, join paid events, and play; scores, rankings, streaks, badges and a
community feed update live. Hosts run live events from a courtside **Host
Console**.

**Stack:** Vite + React → GitHub Pages (static) · Supabase (Postgres + Auth +
Realtime + Edge Functions) · Google OAuth (login) · Xendit (payments) ·
Namecheap (DNS).

---

## 2. Key URLs

### Product
| What | URL |
|---|---|
| Live app | https://ternakpadel.xyz |

### Code & deploy
| What | URL |
|---|---|
| GitHub repo | https://github.com/erdiantomy/ternakpadel |
| Actions (deploys) | https://github.com/erdiantomy/ternakpadel/actions |
| Pages settings | https://github.com/erdiantomy/ternakpadel/settings/pages |
| Build secrets (Actions) | https://github.com/erdiantomy/ternakpadel/settings/secrets/actions |

### Supabase (project ref: `qsgwtjcrgedjbjsbibxr`)
| What | URL |
|---|---|
| Project home | https://supabase.com/dashboard/project/qsgwtjcrgedjbjsbibxr |
| Table editor | https://supabase.com/dashboard/project/qsgwtjcrgedjbjsbibxr/editor |
| SQL editor | https://supabase.com/dashboard/project/qsgwtjcrgedjbjsbibxr/sql/new |
| Auth → Users | https://supabase.com/dashboard/project/qsgwtjcrgedjbjsbibxr/auth/users |
| Auth → Providers | https://supabase.com/dashboard/project/qsgwtjcrgedjbjsbibxr/auth/providers |
| Auth → URL config | https://supabase.com/dashboard/project/qsgwtjcrgedjbjsbibxr/auth/url-configuration |
| Edge Functions | https://supabase.com/dashboard/project/qsgwtjcrgedjbjsbibxr/functions |
| Function secrets | https://supabase.com/dashboard/project/qsgwtjcrgedjbjsbibxr/settings/functions |
| API keys | https://supabase.com/dashboard/project/qsgwtjcrgedjbjsbibxr/settings/api |
| Logs | https://supabase.com/dashboard/project/qsgwtjcrgedjbjsbibxr/logs/explorer |

**Supabase API base:** `https://qsgwtjcrgedjbjsbibxr.supabase.co`
**Publishable (anon) key — public, used by the browser:**
`sb_publishable_V3fEy78NJsVyztWQ-gqPMw_Sjj-o5Zu`

### Edge function endpoints
| Function | URL | Purpose |
|---|---|---|
| create-invoice | https://qsgwtjcrgedjbjsbibxr.supabase.co/functions/v1/create-invoice | Creates a Xendit payment invoice when a player joins |
| xendit-webhook | https://qsgwtjcrgedjbjsbibxr.supabase.co/functions/v1/xendit-webhook | Marks a player paid when Xendit confirms |
| fonnte-webhook | https://qsgwtjcrgedjbjsbibxr.supabase.co/functions/v1/fonnte-webhook | Inbound WhatsApp messages (optional) |
| send-otp-whatsapp | https://qsgwtjcrgedjbjsbibxr.supabase.co/functions/v1/send-otp-whatsapp | **Deprecated** — old WhatsApp OTP login (replaced by Google) |

### External dashboards
| Service | URL |
|---|---|
| Google Cloud (OAuth) | https://console.cloud.google.com/apis/credentials |
| Xendit (payments) | https://dashboard.xendit.co |
| Namecheap (DNS) | https://ap.www.namecheap.com/domains/list |
| Fonnte (WhatsApp, optional) | https://fonnte.com |

---

## 3. Roles

Privilege tiers (highest first):

| Role | Who | Powers | How granted |
|---|---|---|---|
| **Superadmin** | A profile with `is_admin = true` | The in-app **Admin Console** at `/admin` (§5): all payments, members, events, matches, content; plus full dashboard access. | Run `0002_admin.sql`, set `is_admin = true` (§5). |
| **Host** | A player with `profiles.is_host = true`, **or** the creator of an event | Opens the **Host Console** for a live event (courtside scoring, round management, live standings). | Set `is_host = true` (see §6.1 or the Admin Console). Event creators auto-host their own event. |
| **Player / Member** | Anyone who signs in with Google | Complete profile, join & pay for events, play, view rankings/feed/profile, create events. | Self-service via Google sign-in. |

> Any signed-in player can create an event (and becomes its host). The Host
> Console for *running* a live event is limited to the event creator or any
> `is_host = true` profile.

---

## 4. Credentials register

Values are **not** stored here — open the linked location to view/rotate.

| Credential | Used for | Stored in | Public? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Browser → Supabase | GitHub Actions secrets | yes (URL) |
| `VITE_SUPABASE_ANON_KEY` | Browser → Supabase | GitHub Actions secrets | yes (publishable) |
| Google OAuth **Client ID** | Login | Google Cloud + Supabase Google provider | semi-public |
| Google OAuth **Client Secret** | Login | Supabase Auth → Providers → Google | **secret** |
| `XENDIT_SECRET_KEY` | Create invoices | Supabase function secrets | **secret** |
| `XENDIT_CALLBACK_TOKEN` | Verify Xendit webhooks | Supabase function secrets | **secret** |
| `APP_URL` | Payment redirects | Supabase function secrets | yes |
| `FONNTE_TOKEN` | WhatsApp send (optional) | Supabase function secrets | **secret** |
| `FONNTE_WEBHOOK_SECRET` | Inbound WhatsApp auth (optional) | Supabase function secrets | **secret** |
| `SEND_SMS_HOOK_SECRET` | Old OTP hook (deprecated) | Supabase function secrets | **secret** |
| Supabase **service_role** key | Admin/server scripts | Supabase → API keys | **secret — never ship to browser** |
| GitHub PAT / Supabase access token | One-time setup scripts | your password manager | **secret** |

Login = **Google OAuth**. Supabase config required (one-time):
1. Google Cloud → OAuth client (Web), redirect URI
   `https://qsgwtjcrgedjbjsbibxr.supabase.co/auth/v1/callback`.
2. Supabase → Auth → Providers → Google → enable + paste Client ID/Secret.
3. Supabase → Auth → URL config → Site URL `https://ternakpadel.xyz`, Redirect
   URLs include `https://ternakpadel.xyz` and `https://ternakpadel.xyz/**`.

---

## 5. Admin Console (in-app, `/admin`)

A superadmin web console lives at **https://ternakpadel.xyz/admin**. It shows and
manages all operational data in one place — no dashboard digging needed.

**Tabs:** Overview (members, paid revenue, pending payments, active events, live
matches, posts) · Members (grant/revoke host & admin) · Payments (every payment,
filter by status, open the Xendit invoice) · Events (create + change status) ·
Matches (live scores) · Content (post announcements to the community feed) ·
Demo (run a full event by hand — see §6.7).

**One-time enable:**
1. Supabase → SQL editor → run `supabase/migrations/0002_admin.sql` (adds the
   `is_admin` flag, an `is_admin()` helper, and admin RLS policies so the console
   can read all payments / manage all events, matches, content).
2. Grant yourself superadmin:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'YOUR_GOOGLE_EMAIL');
   ```
3. Supabase → Auth → URL config → ensure Redirect URLs include
   `https://ternakpadel.xyz/**` (covers `/admin`).
4. Open `/admin`, sign in with that Google account. (If it says "Not authorized",
   you haven't run steps 1–2, or need to sign out/in to refresh the flag.)

Access is enforced server-side by RLS (`is_admin()`), not just hidden in the UI —
a non-admin cannot read payments or write operational tables even via the API.

---

## 6. Admin playbook (you)

### 6.1 Make someone a host
Supabase → SQL editor:
```sql
update public.profiles
set is_host = true
where id = (select id from auth.users where email = 'person@gmail.com');
```
Or Table editor → `profiles` → find the row → toggle `is_host` → save.

### 6.2 See / manage users
Auth → Users lists every Google sign-in. Profile data (name, skill, city,
host flag) lives in Table editor → `profiles` (keyed by the same `id`).

### 6.3 Start a live event
1. The event exists (a host created it in-app, or insert in `events`).
2. Table editor → `events` → set the event's `status` = `live`.
3. Create round-1 `matches` rows (or let the host start pairings in-app).
4. Players see live courts under **Matches**; the host runs it from the Host
   Console (Settings ⚙ → Open host console): score, **End round** auto-generates
   next pairings, **End match** posts results, points, ranks, badges, feed.

### 6.4 Payments
- Invoices are created by `create-invoice`; `xendit-webhook` flips
  `event_players.paid = true` on confirmation.
- Test vs live: until Xendit KYC is approved, use **Test mode** keys — the full
  flow works with test payment methods. After approval, swap `XENDIT_SECRET_KEY`
  to the live key and re-register the webhook URL for live mode.

### 6.5 Season rollover (manual)
```sql
update public.seasons set is_current = false where is_current = true;
insert into public.seasons (name, starts_on, ends_on, is_current)
values ('Season 2026/27', '2026-09-01', '2027-08-31', true);
```

### 6.6 Deploy / ship code
Push to `main` → GitHub Actions builds and publishes to Pages automatically
(~1–2 min). Manual run: Actions → Deploy to GitHub Pages → Run workflow. Live
mode requires the two `VITE_SUPABASE_*` Actions secrets to be set.

### 6.7 Demo Mode (admin manual fulfilment)
The **Demo** tab in `/admin` lets you run a whole event by hand — useful for
showcases and onboarding players before they sign in. It is **not** a sandbox:
scores feed the **real** leaderboard, so a player you create during a demo keeps
the same id and points when they later sign in for real.

Flow:
1. **Add temporary player** — name (+ optional login email/phone). Creates a real
   account so its id is permanent. Leave the email blank for a placeholder.
2. **Link login email** — set/replace a player's login email any time. When that
   person signs in with Google or an email magic-link using that address, they
   continue the same id and keep their points (no merge needed).
3. **Demo event** — pick an event (create it in the Events tab first).
4. **Roster** — add players; they're marked **paid** directly, bypassing Xendit.
5. **Matches** — build a match from the roster, tap +/− to score, **Finish** to
   award season points / ranks / badges and post to the feed (same `finish_match`
   the live app uses).

**One-time enable:**
1. Run `supabase/migrations/0010_demo_mode.sql` (lets an admin finish any match).
2. Deploy the provisioning function: `supabase functions deploy provision-player`
   (uses the existing service-role secret; no new keys).
3. Supabase → Auth → enable **same-email identity linking** ("allow linking
   identities with the same email") so a later Google sign-in attaches to the
   email you provisioned instead of erroring.
4. Optional: set the Actions secret `VITE_DEMO_MODE=false` to hide the Demo tab.

---

## 7. Host guide (running an event)

1. Sign in (Google) on https://ternakpadel.xyz.
2. **Create an event:** tap the **+** (FAB) → name, format (Americano, Mexicano,
   League, etc.), courts, max players, date → create. Registration opens.
3. When it's match day and the event is `live`, open **Settings ⚙ → Open host
   console** (best on a tablet/iPad).
4. In the console: score each court, **End round** to auto-pair the next round,
   manage resting players, watch live standings.
5. **End match** finalizes results — points, rankings, streaks, badges and the
   community feed all update across every player's phone in realtime.

---

## 8. Player guide (members)

1. Open https://ternakpadel.xyz.
2. Tap **Continue with Google** → pick your account.
3. Answer the quick profile questions (skill, side, frequency, goal). You get
   your **Rookie** badge.
4. **Home** shows the next match day + community feed. **Events** lists
   tournaments → open one → **Join** → pay via Xendit (QRIS / OVO / Dana /
   ShopeePay / VA) → you're on the roster.
5. On match day, check in; **Matches** shows your live court and score.
6. **Rankings** = season leaderboard. **Profile** = your career: rank, win rate,
   streak, badges, timeline. Nothing resets — stats accumulate.

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `redirect_uri_mismatch` on Google | Google OAuth redirect URI must be exactly `https://qsgwtjcrgedjbjsbibxr.supabase.co/auth/v1/callback` |
| Returns from Google to blank/loop | Add `https://ternakpadel.xyz` to Supabase Auth → URL config → Redirect URLs |
| App shows demo data | `VITE_SUPABASE_*` Actions secrets missing → set them, re-run deploy |
| Payment never confirms | Check `xendit-webhook` is registered in Xendit and `XENDIT_CALLBACK_TOKEN` matches |
| Edge function errors | Supabase → Functions → (function) → Logs |

---

## 10. Data model (tables)

`profiles` · `seasons` · `player_points` · `rank_history` · `events` ·
`event_players` · `payments` · `matches` · `feed_posts` · `feed_likes` ·
`badges` · `player_badges`. Schema source: `supabase/migrations/0001_init.sql`.
