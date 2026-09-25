# Bachelor Party Ring Tracker

A wins/losses leaderboard PWA for Tyler's LOTR-themed bachelor party. It's built with Next.js (App Router) on Vercel and Supabase Postgres, with Realtime updates.

## Screens

| Route    | What it does |
|----------|--------------|
| `/`      | **Report a win.** You pick your name the first time, and the phone remembers it in `localStorage`. Tap a game to get +1, and the toast lets you undo it within 60 seconds. For Kahoot, tap once per placement point. |
| `/board` | **Leaderboard** (put it on the TV). It shows totals, rank titles, Tyler's curse status and streak, the communal **TYLER LOST** button, and per-game side prizes. |
| `/host`  | **Host panel** (hidden, PIN-gated). Change the threshold and streak, turn the curse on or off, end or reopen the competition (the fallback rule is that the highest total wins), rename or add guests, delete mis-taps, and show the table-tent QR code. |

## How scoring works

Nothing is stored as a total. Every number is derived by replaying `point_events` in insertion order. The logic is in `lib/scoring.ts`, and Tyler's curse check is mirrored in SQL as `private.tyler_ring_back()`.

- **Normal players:** a win is +1, and a loss is free.
- **Tyler:** a win is +1 and every loss is −1 while he's cursed. The curse lifts when his total reaches the threshold **or** he wins N in a row. After that, his losses are free.
- **Grand winner:** the first player whose running total crosses the threshold. If the host ends the competition before anyone gets there, the highest total wins, and a tie goes to whoever reached that total first.

`lib/config.ts` holds the games list and the default numbers. The live threshold, streak length and curse on/off switch are kept in the `settings` table, so the host can change them mid-party without a deploy.

## Security model

There's no user auth, as the spec asks. The browser only ever gets the Supabase **publishable** key.

- RLS is on for every table, and `anon` can only `SELECT`.
- Every write goes through a `SECURITY DEFINER` RPC that validates its input: `report_win`, `tyler_lost`, `undo_event`, and the `admin_*` functions.
- Host RPCs require the PIN. It's stored as a bcrypt hash in the `private` schema, which the API doesn't expose.

Change the PIN in the Supabase SQL editor:

```sql
update private.admin set pin_hash = extensions.crypt('NEW_PIN', extensions.gen_salt('bf')) where id = 1;
```

## Local dev

```bash
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm install
npm run dev
```

The schema, RPCs, Realtime publication and roster seed are all in `supabase/migrations/`. On a fresh project, run that migration, then set the PIN with the SQL above, using `insert into private.admin (id, pin_hash) values (1, …)` the first time.
