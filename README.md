# Caption Drop

Upload any photo, let Gemini caption it in three voices, and let everyone vote on
which one actually lands. Built with Next.js 16 (App Router) and Supabase.

The three voices — **Sarcastic**, **Wholesome** and **Unhinged** — are tones
rather than personas, so they land on any photo: a dog, a sandwich or a skyline.
They spread deliberately across the emotional range (mean, kind, chaotic) so
there is something real to vote between.

Voices live in the `voices` table, so adding or retiring one is a row rather than
a deploy. Retiring sets `is_active = false` instead of deleting, because
`captions.voice` is a foreign key — retired rows stay readable so an older
caption keeps showing the voice that actually wrote it.

- **Gallery** (`/`) — public. Anyone can browse captions and read the prompt that
  produced each one.
- **Drop a photo** (`/create`) — signed in only. Upload any photo, get one caption
  per voice.
- **Leaderboard** (`/leaderboard`) — public. Today's captions ranked by votes cast
  today, where "today" is an Eastern-time calendar day.
- **Dashboard** (`/dashboard`) — your captions, your votes, your streak.
- **Profile** (`/profile`) — name and avatar.

## Getting started

```bash
npm install
npm run dev
```

`.env.local` needs:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
GEMINI_API_KEY=<key from https://aistudio.google.com/apikey>
```

`SUPABASE_SECRET_KEY` is only needed to re-run `scripts/upload-seed-images.mjs`.

## How a generation works

1. The browser decodes the photo, downscales it to 1600px on the long edge, and
   uploads it to the `images` bucket at `<user-id>/drop-<timestamp>.jpg`.
2. A Server Action reads those bytes **back out of Storage**. The photo is
   deliberately not passed through the action: a Server Action request body is
   capped at 1MB, which is smaller than most phone photos.
3. A `generations` row is written as `pending`, recording the model, the system
   instruction and the prompt, before the call goes out.
4. One Gemini call returns a caption for every voice at once.
5. Each caption is saved with `captions.prompt` — the exact rendered prompt for
   that voice, so every caption carries the prompt that produced it.

### Model choice

`lib/gemini.ts` tries `gemini-3.5-flash`, then `gemini-3.1-flash-lite`. Measured
against this project's own key:

| Model | Result |
| --- | --- |
| `gemini-3.5-flash` | ~5s, best captions |
| `gemini-3.1-flash-lite` | ~4s, blander but steady |
| `gemini-3.5-flash-lite` | ~28s, erratic |
| `gemini-3.8-flash` | rate-capped at 20 requests, frequent 503s, one success took 61s |

The newest model is **not** the right pick here. Two further gotchas:

- `gemini-2.5-flash` is retired — it 404s with "no longer available to new
  users", so older tutorials won't run.
- The API is the **Interactions API** (`ai.interactions.create`), and its
  parameters are snake_case (`system_instruction`, `response_format`,
  `generation_config`). camelCase is rejected outright. The reply text is on
  `response.output_text`.

## Database

| Table | Purpose |
| --- | --- |
| `profiles` | Name, avatar, and streak counters. Created by an `auth.users` trigger. |
| `images` | One row per uploaded photo. `user_id` is null for the Week 3 seed images. |
| `voices` | The caption tones. Adding or retiring one is a row, not a deploy. |
| `generations` | One row per Gemini call: model, prompt, raw response, tokens, latency. |
| `captions` | The captions, each with the exact prompt, plus vote counters. |
| `votes` | One row per (caption, user), `value` of `+1` or `-1`. |
| `caption_daily_stats` | Per-caption, per-day tallies. Trigger-maintained. |
| `daily_leaderboard` | View over today's stats, ranked. |

Vote totals are kept by `apply_vote_counts()` on insert, update and delete, so
flipping or retracting a vote rebalances both the all-time counters and the
daily tallies. `touch_vote_streak()` advances the streak on the first vote of a
new Eastern-time day — only on insert, so re-flipping an old vote can't farm a
streak.

### Row Level Security

RLS is on for every table in `public`, and the policies split along one line:
**anything needed to render the public gallery is world-readable; anything you
authored is writable only by you.**

- Public read: `profiles`, `images`, `captions` (including `prompt`),
  `caption_daily_stats`, `voices`.
- Owner-only read: `generations` (prompts and raw model responses) and `votes`
  (so nobody can audit who downvoted them).
- `votes` has no policy for `anon` at all, so signed-out visitors are blocked
  from voting by the database and not merely by the UI.
- `caption_daily_stats` has no write policy. Only the SECURITY DEFINER vote
  triggers touch it, which is what keeps scores honest.
- The trigger functions have `EXECUTE` revoked from `anon` and `authenticated`.
  Supabase exposes every `public` function at `/rest/v1/rpc/<name>`, so without
  that revoke anyone with the anon key could call `bump_caption_counts()` with
  invented numbers and forge the leaderboard.

Storage: the `images` and `avatars` buckets both allow writes only inside
`<user-id>/`.

## Notes

- Next.js 16 renamed Middleware to Proxy, so route gating lives in `proxy.ts` and
  the export is `proxy`. A `middleware.ts` here would simply never run.
- `/create` sets `maxDuration = 60`, which is what governs the Server Actions
  called from that page.
