# Function Review Notes

Full correctness review of every function in the app, checked against the `main`
branch (commit `315028d`). Scope: all 9 Supabase Edge Functions, the SQL
functions in `supabase/migrations`, the pure helpers in `src/lib`, and every
function in the frontend (`src/live`, `src/screens`, `src/admin`,
`src/components`). Each item cites `file:line` on that commit.

**Overall verdict: the functions are correct.** Auth gating, payment
idempotency, SSRF guards, RLS design and schema assumptions all check out.
The items below are what's worth noting — ordered by severity within each
section, with a consolidated priority list at the end.

---

## 1. Edge Functions (`supabase/functions/*/index.ts`)

| Function | Purpose | Verdict |
|---|---|---|
| `create-invoice` | Create Xendit invoice for an approved join | ✅ correct |
| `check-payment` | Poll Xendit for pending invoices, mark paid | ✅ correct |
| `xendit-webhook` | Xendit invoice callback → mark paid | ✅ correct |
| `fonnte-webhook` | Incoming WhatsApp webhook (placeholder) | ⚠️ fails open without secret |
| `send-otp-whatsapp` | Auth Send-SMS hook → OTP via Fonnte | ✅ correct |
| `provision-player` | Admin-only demo player provisioning | ✅ correct |
| `import-reclub` | Parse a reclub event page for create form | ✅ correct |
| `import-reclub-player` | Validate a reclub player link | ✅ correct |
| `sync-reclub-all` | Nightly re-sync of reclub events | ⚠️ clobbers manual edits |

### 1.1 `sync-reclub-all` — nightly sync overwrites admin edits with parser fallbacks
`sync-reclub-all/index.ts:143-147`. `parseCaption()` **always** returns a
truthy `title` (fallback `"Padel Session"`, line 70) and `type` (fallback
`"Americano"`, line 64), so the update

```js
title: d.title || e.title, type: d.type || e.type, ...
```

takes the parsed value every night — `e.title`/`e.type` are dead fallbacks.
Consequences:
- A title or type an admin corrected by hand is silently reset every night at
  02:00 WIB.
- Worse, when the `__NUXT_DATA__` payload fails to parse (reclub markup
  change), the caption falls back to the `<title>` tag (line 87) and the fuzzy
  scrape can replace good data with junk.

**Recommended fix:** only overwrite `title`/`type`/`venue` when the Nuxt
payload parsed (`meet` is non-null), and/or skip fields whose parsed value is
the generic fallback. The same pattern exists in the admin's explicit
"🔄 re-sync" button (`src/admin/AdminConsole.jsx:209`), but there it's an
intentional user action — the nightly cron is the risk.

### 1.2 `fonnte-webhook` — fails open when the secret is unset
`fonnte-webhook/index.ts:45`: `if (SECRET && url.searchParams.get("secret") !== SECRET)`
means a deployment without `FONNTE_WEBHOOK_SECRET` accepts any POST. Harmless
today (the handler only logs, lines 57-62), but the guard must fail **closed**
(`if (!SECRET || ...)`) before real logic is added.

### 1.3 Payment races (low likelihood, worth knowing)
- **Capacity:** `create-invoice/index.ts:44-48` checks `max_players` before
  creating the invoice, but neither `xendit-webhook/index.ts:25-41` nor
  `check-payment/index.ts:61-83` re-checks capacity when marking paid. Two
  players paying concurrently for the last slot can both end up `paid`
  (also true when an invoice is paid after the event filled).
- **Duplicate feed post:** the polling path (`check-payment`) and the webhook
  can process the same PAID invoice concurrently; the `payments` update is
  idempotent-ish (webhook guards `pay.status !== "paid"`, line 25) but both
  can pass the read before either writes, yielding two "joined …" feed posts.
- **Orphan rows:** if the Xendit create call *throws* (network error) after
  `create-invoice/index.ts:83-86` inserted the payment, the row stays
  `pending` with `external_id = null` forever. Harmless — every consumer
  filters `external_id is not null` — but rows accumulate.

### 1.4 Small notes
- `xendit-webhook` doesn't cross-check `body.amount` against the stored
  payment. Mitigated by the callback token and by amounts being server-set in
  `create-invoice`, but a one-line `body.amount === pay.amount` check is
  standard hardening. Matching `body.id` against `pay.external_id` would be
  equally cheap.
- `check-payment` / `xendit-webhook` upsert `event_players` without
  `onConflict` — **valid**, because the table's primary key is
  `(event_id, player_id)` (`0004_rebuild.sql:105`).
- `create-invoice` will 502 for a free event (`ev.fee` = 0 is below Xendit's
  minimum). The UI only shows "Pay" for `approved` players, but nothing stops
  an admin creating a fee-0 event with join approval on.
- `provision-player` `set_email` (`index.ts:55-67`) can retarget **any** auth
  user's email (with `email_confirm: true`), not just demo-provisioned ones.
  Caller must be a superadmin, so this is accepted — but it is effectively an
  account-takeover primitive; consider restricting to users with
  `user_metadata.demo_provisioned`.
- `send-otp-whatsapp/index.ts:15` uses `!` assertions on env vars — a missing
  `SEND_SMS_HOOK_SECRET` produces an opaque 500 rather than a clear error.
  Correctly treats Fonnte's HTTP-200-with-`status:false` responses as failure
  (lines 45-52).
- `import-reclub/index.ts:18`: the `PASS` set lists `"Reactive"` twice
  (harmless duplicate). `sync-reclub-all`'s copy (line 16) is correct.
- SSRF guards in both import functions are sound (https + host regex + path
  check), but `fetch` follows redirects *after* the check — a reclub.co
  redirect could point elsewhere. Low risk; `redirect: "manual"` or
  re-validating the final URL would close it.
- `import-reclub-player`: a non-string `url` in the body throws inside the
  handler → 500 instead of a 400 (cosmetic).

---

## 2. SQL functions (`supabase/migrations`)

Current definitions: `finish_match` → `0011_demo_flag.sql` (supersedes
0001/0003/0004/0010); `handle_new_user`, `is_admin` → `0004_rebuild.sql`;
`is_host` → `0006`; `owns_padel`, `is_session_host`,
`hash_venue_admin_password`, `verify_venue_admin` → `0009`;
`trigger_reclub_sync` → `0011_nightly_reclub_sync.sql`.

- ✅ All helpers correctly use `security definer stable set search_path = public`
  — the right pattern to avoid RLS recursion and search-path attacks.
- ✅ `finish_match` (0011): caller check (participant / host / admin, lines
  46-49), `for update` lock + already-done guard (40-42), idempotent point
  upserts, demo `is_demo` propagation to the feed post. Notes:
  - **Ties award the win to team A** (`score_a >= score_b`, line 55). With
    `targetMode: "bestof"` (fixed total points) a tie is reachable; decide if
    that's the intended rule.
  - **If no season has `is_current`** (`line 51`), `season` is null and the
    first `player_points` insert raises (`season_id` not null) — the whole
    finish fails. Worth a guard or at least knowing the failure mode when
    Season 3 ends 2026-08-31.
  - Losers correctly get `+2` pts, `streak = 0`, no win increment.
- ✅ `handle_new_user` (0004:41-47): profile + rookie badge on signup; the
  backfill at 0004:364 covers pre-trigger users.
- ✅ `verify_venue_admin` / `hash_venue_admin_password` (0009): bcrypt via
  pgcrypto, trigger re-hash guard (`not like '$2%'`). Note:
  `verify_venue_admin` is executable by `anon` with no rate limiting —
  unlimited password guesses (low risk, but note it).
- ✅ `trigger_reclub_sync` (0011): secret read from RLS-locked `app_config`,
  execute revoked from clients. Note: the edge-function URL is **hardcoded**
  to project `qsgwtjcrgedjbjsbibxr` (line 24) — breaks silently if the
  project ref ever changes.
- ✅ 0006's comment about pinning the role in `WITH CHECK` (not just `USING`)
  is correct and important — permissive UPDATE policies OR-combine, and the
  written version does close the self-approval escalation.

---

## 3. Lib helpers (`src/lib`)

All four files are ✅ correct.

- `session.js` — the pairing/rounds engine is sound: `sessionConfig` fills
  legacy defaults, `pairCourts` caps at the venue's court count and returns
  the resting tail, `orderForRound` re-seeds by standings (mexicano) or
  rotates (americano), `buildRound` composes them. One semantic note:
  `matchComplete` (`session.js:79-82`) treats "bestof" as *fixed total
  points* (`score_a + score_b >= target`) — correct for americano-style play,
  just don't confuse it with "best of N sets".
- `courts.js` — `courtName(n)` maps 1-based numbers, falls back to
  `"Court N"`. Fine.
- `format.js` (`rupiah`), `supabase.js` (null client when env unset,
  guarded by `App.jsx:7`) — fine.

---

## 4. Frontend

### 4.1 `SessionManager.jsx` — `renamePlayer` drops name-only players' names
`SessionManager.jsx:246`:

```js
const resolve = (pid) => nextNames[pid] || firstName(profilesById[pid]?.full_name);
```

Unlike `nameOf` (line 64), `resolve` **omits the `lineupNames` fallback**. A
name-only lineup player (no profile, no per-session rename) resolves to
`"Player"`. So renaming *any* player rewrites `team_a_names`/`team_b_names`
on every shared match, replacing each name-only teammate with "Player".
**Fix:** `nextNames[pid] || lineupNames[pid] || firstName(...)`.

### 4.2 `LiveApp.jsx` — `endRound` ignores the session config
- `nextPairings` (`LiveApp.jsx:57-75`) is a hand-rolled duplicate of
  `pairCourts`/`buildRound` from `src/lib/session.js` that always uses
  balanced pairing — it never respects the event's `config.fixedPartner` or
  format.
- `endRound` (`LiveApp.jsx:531-546`) inserts next-round matches **without
  `target`** (defaults to 21, ignoring a configured race-to/best-of value)
  and **without `order_index`**, unlike `SessionManager.insertRound`
  (`SessionManager.jsx:171-176`) which sets both.

The organizer path (SessionManager) is correct; the Host-console path
(HostConsole → `A.endRound`) silently diverges from the configured format.
**Fix:** make `endRound` call `buildRound` with `sessionConfig(event)` and
carry `target`/`order_index`, and delete `nextPairings`.

### 4.3 UI manage-gate is wider than RLS allows
`canManageEvent` (`LiveApp.jsx:264`) and `manageSession` (`LiveApp.jsx:615-622`)
let **any** `is_host` manage **any** event, but RLS only permits the event
*creator* or an *admin* to:
- update/delete matches (`0004_rebuild.sql:324-326`, `0014:26-27`),
- update the event row / status,
- upsert roster rows (`0015_organizer_roster.sql` covers `created_by` only).

A non-creator host opening SessionManager on someone else's event gets writes
that either error (with-check violations → toast) or **silently match zero
rows** (USING-filtered updates like scoring). Either tighten the UI gate to
`created_by === uid || is_admin`, or extend the policies to hosts.

### 4.4 Joined-count double-counts the current user
`HomeEvents.jsx:45` (`MatchDayHero`) and `HomeEvents.jsx:179-181`
(`EventsScreen`) display `ev.joined + (joined ? 1 : 0)`. In the live app,
`S.events[].joined` (built at `LiveApp.jsx:276-281`) **already includes** the
current user's paid roster row, and `S.joined[ev.id]` is true exactly when
the user is paid — so joined players see the count inflated by one (e.g.
"9/16" when 8 are in). Leftover from the prototype where `joined` was
simulated client-side. **Fix:** drop the `+ (joined ? 1 : 0)` terms (and the
matching one in the avatar `+N` overflow at line 54).

### 4.5 Other LiveApp / screen notes (minor)
- **Lost-update races on scoring:** `A.score`, `A.scoreCourt`
  (`LiveApp.jsx:497-512`), `SessionManager.score` (211-216) and
  `AdminConsole.scoreMatch` (342-350) all do read-modify-write on
  `score_a/score_b`; two concurrent scorers can drop an increment. An atomic
  `increment` RPC would fix it; realtime refresh makes it self-correcting in
  practice.
- **`checkIn` false success** (`LiveApp.jsx:480-487`): updates the hero
  event's row and toasts "Checked in 🎾" even when the user has no roster row
  (update matches 0 rows). No error surfaced, no result checked.
- **`generateNext` excludes late additions** (`SessionManager.jsx:181-190`):
  `baseIds = playedIds.length ? playedIds : roster` means a player added
  after round 1 never enters later rounds unless the organizer regenerates
  the whole schedule. May be intended ("continue from the previous
  generation") — worth a UI hint.
- **Dead code:** `PaySheet` (`HomeEvents.jsx:286-334`) is unreachable — it
  looks up `S.paying` as an event id but LiveApp sets `paying: payBusy`
  (a boolean); the real flow redirects to Xendit. Likewise the simulated
  `Onboarding` in `Profile.jsx:270-378` is superseded by `LiveOnboarding`
  and never imported. Both are prototype leftovers safe to delete.
- **Cosmetic/demo stubs still wired to real screens:** RankingsScreen's
  period/division filters (`LiveRank.jsx:126-141`) don't filter anything;
  Profile's "S1 · #19 / S2 · #11" labels (`Profile.jsx:45-47`) are
  hard-coded; Host console's round timer "12:42" (`Host.jsx:80`), walk-in
  and announce buttons are toast-only.
- `LiveOnboarding.finishQuestions` (`LiveOnboarding.jsx:84-93`): the random
  `@name###` username can collide with the unique constraint → error toast,
  user must re-tap. Fine, just unhandled retry.
- `Spark` (`atoms.jsx:142-155`) divides by `vals.length - 1` — a 1-point
  array yields NaN; the only caller always passes ≥ 2 (`LiveApp.jsx:398`),
  so OK as long as that invariant holds.

### 4.6 `AdminConsole.jsx`
- `EVENT_STATUS` (line 21) omits `'paused'` (added in `0014`); a paused
  event's status `<select>` shows the wrong value and the admin console can't
  set it. Add `"paused"` to the list.
- `toggle` (236-240) lets an admin switch **their own** `is_admin` off —
  locks themselves out of the console. Cheap guard: disable the switch for
  `p.id === session.user.id`.
- `createEvent` upsert on `source_ref` (174-176) correctly leaves the
  existing `status` alone (column not in the payload).
- Demo-mode functions (provision/link/roster/match/finish) all match the RLS
  model (`admin manage *` policies + service-role edge function). ✅
- `parseFlyer` (30-86) is best-effort by design; admin reviews before saving.

### 4.7 Design/informational (not bugs)
- Demo hiding (`is_demo`) is a client-side query filter (`LiveApp.jsx:141-143`)
  — the RLS still lets any authenticated user select demo events. Fine as a
  UX feature, but don't treat it as confidentiality.
- `App.jsx`, `main.jsx`, `theme.js`, `atoms.jsx`, `SettingsSheet.jsx`,
  `BrandMark.jsx`, `Host.jsx` (render logic), `LiveRank.jsx` (render logic)
  are ✅ correct. `theme.js`'s `--accent-soft` hex+alpha concatenation
  requires 6-digit hex accents — all presets comply.

---

## 5. Priority list

| # | Severity | Item | Where |
|---|---|---|---|
| 1 | **High** | Nightly sync clobbers admin-edited title/type with parser fallbacks | `sync-reclub-all/index.ts:143-147` |
| 2 | **High** | `renamePlayer` wipes name-only players' names in match rows | `SessionManager.jsx:246` |
| 3 | Medium | `endRound` ignores config `target`/format; duplicate pairing logic | `LiveApp.jsx:57-75, 531-546` |
| 4 | Medium | UI lets non-creator hosts "manage" events RLS won't let them write | `LiveApp.jsx:264` vs `0015_organizer_roster.sql` |
| 5 | Medium | Joined count double-counts the current user | `HomeEvents.jsx:45,54,179-181` |
| 6 | Medium | `fonnte-webhook` fails open without secret | `fonnte-webhook/index.ts:45` |
| 7 | Low | Admin console can't show/set `paused`; self-de-admin footgun | `AdminConsole.jsx:21,236` |
| 8 | Low | Payment races: capacity re-check, duplicate feed post, amount check | §1.3, §1.4 |
| 9 | Low | `finish_match`: tie → team A; fails hard with no current season | `0011_demo_flag.sql:51,55` |
| 10 | Cleanup | Dead code (`PaySheet`, prototype `Onboarding`), stub UI, scoring RMW races | §4.5 |
