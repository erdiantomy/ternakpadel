# Ternak Padel — Complete Guide (Admin & Players)

How the app works, and how to use **every** feature — for superadmins, hosts, and
players. For URLs, credentials and infrastructure, see `DOCUMENTATION.md`.

- App: **https://ternakpadel.xyz**
- Admin console: **https://ternakpadel.xyz/admin**

---

## Part A — How it works (the big picture)

```
Player → Google sign-in → profile created → joins an event → pays (Xendit)
        → payment confirmed (webhook) → on match day the HOST runs the event
        → each finished match triggers the "win cascade":
           points + rank + streak + badges + a feed post, pushed live to every phone.
ADMIN watches and manages all of it from /admin.
```

Key ideas:
- **One identity:** players sign in with Google. No passwords. Their Google name
  seeds their profile.
- **Roles:** *Player* (everyone) → *Host* (`is_host`, or whoever created an event)
  → *Superadmin* (`is_admin`). Higher roles add powers; they don't replace the
  player experience.
- **Source of truth is the database (Supabase).** The app and the admin console
  are just views onto it; payments are confirmed by Xendit, not by hand.
- **Realtime:** scores, rosters and the feed update on every device instantly —
  no refresh needed.
- **Nothing resets:** stats accumulate across a season; badges are permanent.

---

## Part B — Player guide (members), end to end

### B1. Sign up / sign in
1. Open **https://ternakpadel.xyz**.
2. Tap **Continue with Google** and choose your account.
3. Answer four quick questions — **skill level, preferred side, how often you
   play, what you're here for**. (You can **Skip** any.)
4. You land on your welcome card with your first badge, **Rookie** → tap
   **Find your first match**.

### B2. Home tab 🏠
- **Match-day hero:** your next/!live event up top. If you've joined and it's
  today, you can **Check in** here.
- **Community feed:** match results, rank changes, new badges, join notices, and
  **admin announcements** (📣). Tap the heart to **like** a post.

### B3. Events tab 🗓️
1. Browse upcoming tournaments (Americano, Mexicano, League, King of the Hill,
   Knockout, Mixicano).
2. Tap an event to open its **detail**: format, venue, date/time, fee, who's in.
3. Tap **Join** → you're sent to a secure **Xendit** payment page.
4. Pay with **QRIS / OVO / DANA / ShopeePay / bank VA**.
5. You're redirected back — "**Payment received — you're in!**" — and your name
   appears on the roster. (Until you pay, you're not on the roster.)

### B4. Match day & the Matches tab 🏸
- **Check in** (Home hero or when prompted) so the host knows you're there.
- When the event is **live**, the **Matches** tab shows your **court**, your
  partners/opponents, and the live score.
- **Scorer mode:** open your live court to add/subtract points; the score syncs
  to everyone in realtime.
- When a match ends you'll see the result animation — points, rank change and a
  share card.

### B5. Rankings tab 🏆
- The **season leaderboard**. Your row is highlighted. Rank is by total points;
  points come from playing (everyone) and winning (more).

### B6. Profile tab 👤
- **Career:** rank, win rate, matches, streak, points, a rank-history sparkline.
- **Badges:** earned vs locked (Rookie, First Match, Iron Player, Undefeated,
  Champion…).
- **Timeline:** your match results and badges over time.
- **Share:** generate a share card of a result or your stats.

### B7. Create your own event (any player) ➕
1. Tap the **+** (center of the tab bar).
2. Set **name, format, courts, max players, date** → **Create**.
3. Registration opens immediately and **you are its host** (see Part C).

### B8. Settings ⚙️
- **Theme** (dark/light), **accent color**, **type pairing**, **density** — saved
  to your device.
- **Replay onboarding** (re-do the intro), and **Open host console** if you're a
  host with a live event.

---

## Part C — Host guide (running a live event)

A host is the event's creator, or anyone with `is_host = true`. Best run on a
tablet at courtside.

### C1. Before the event
- Create the event (Part B7) or have it created for you.
- Players register and pay; watch the roster fill.

### C2. Start it live
The event must be set to **live** (an admin can flip this in
`/admin → Events → Status`, or in Supabase). Round-1 matches are created (host
flow / admin), and play begins.

### C3. In the Host Console (Settings ⚙ → Open host console)
- **Score every court** at once.
- **End round** → the app auto-generates the next round's **pairings**
  (Americano logic: rank-balanced groups of four) and pushes them to all phones.
- Manage **resting** players and **check-ins**; see **live standings**.
- **End match** runs the **win cascade**: winners get event points + 2, losers
  get 2; streaks update; ranks are snapshotted; badges are awarded; a result is
  posted to the feed — all live.

---

## Part D — Admin / Superadmin guide (the /admin console)

### D0. Access
1. You must be a superadmin (`is_admin = true`). To enable the very first admin,
   run `supabase/migrations/0004_rebuild.sql` (or the `update … is_admin` grant)
   in the Supabase SQL editor — see `DOCUMENTATION.md §5`.
2. Open **https://ternakpadel.xyz/admin** → **Continue with Google** with your
   admin account.
3. If it says **Not authorized**, your account isn't flagged yet (or sign out/in
   to refresh).

The console is enforced by server-side security (RLS): a non-admin can't read
payments or change data even outside the UI.

**Layout:** left sidebar = tabs; top-right = **↻ Refresh**; bottom-left = your
name, **← Back to app**, and **Sign out**.

### D1. Overview 📊
Six live metrics at a glance:
- **Members** — total registered players.
- **Revenue (paid)** — sum of all confirmed payments.
- **Pending payments** — invoices created but not yet paid.
- **Active events** — events that are `open` or `live`.
- **Live matches** — matches currently in play.
- **Feed posts** — total community posts.

### D2. Members 👥
Table of every player: avatar, **name, username, city, skill, joined date**, and
two switches:
- **Host** — turn on to let them run live events (Host Console).
- **Admin** — turn on to make them a **full superadmin** (same powers as you,
  including this console).

**Create another admin:** the person signs in once at the app (so a profile
exists) → here, flip their **Admin** switch on. To revoke, flip it off.

### D3. Payments 💳
Every payment, newest first. Columns: **date, player, event, amount, method,
status, invoice link**. Filter chips: **all / paid / pending / expired / failed**.
- Status colors: paid (green), pending (amber), expired (grey), failed (red).
- **Open ↗** jumps to that Xendit invoice.
- Read-only on purpose — payment status is owned by Xendit's webhook, so the
  numbers are always trustworthy. (To reconcile a stuck payment, check Xendit.)

### D4. Events 🎾
- **Create event** (top card): title, type, date/time, venue, fee (Rp), courts,
  max players → **Create**. It opens for registration immediately.
- **Events table:** title, type, when, venue, fee, **Paid/Max** (paid roster vs
  capacity), and a **Status** dropdown.
- **Change status** with the dropdown:
  - `open` — registration open
  - `live` — **starts the event** (players see live courts)
  - `done` — finished/archived
  - `cancelled` — hidden from players

### D5. Matches 🏸
Read-only view of all matches: **event, round, court, team A, team B, score,
status** (live in green). Use it to monitor play across every court/event.

### D6. Content 📣
- **Post announcement:** type a message → **Publish**. It appears in every
  player's **Home feed** with a 📣 icon, labeled "Pengumuman".
- Below: the latest posts (date, author, kind, text) so you can see what's live.

### D7. Everyday admin tasks
| Task | Where |
|---|---|
| Make someone a host | Members → **Host** switch |
| Make someone an admin | Members → **Admin** switch |
| Start an event | Events → **Status → live** |
| Cancel an event | Events → **Status → cancelled** |
| Announce news | Content → **Publish** |
| Check revenue / pending | Overview / Payments |
| Investigate a payment | Payments → **Open ↗** (Xendit) |
| Refresh the data | top-right **↻** |

For deeper operations (season rollover, schema, deploys), see
`DOCUMENTATION.md §6`.

---

## Part E — FAQ / troubleshooting

- **"Not authorized" at /admin** → your Google account isn't `is_admin`. Grant it
  (Members switch from another admin, or the SQL grant), then reload.
- **A player paid but isn't on the roster** → confirm Xendit fired the webhook
  (Payments shows `pending` if not). Status is webhook-driven.
- **Announcement didn't show** → it posts to the feed (Home tab); pull to refresh.
- **Login loops / blank after Google** → Supabase Auth → URL config must list
  `https://ternakpadel.xyz/**` (see `DOCUMENTATION.md §4`).
- **Stats look empty** → make sure a season exists and is current (Supabase
  `seasons.is_current = true`).
