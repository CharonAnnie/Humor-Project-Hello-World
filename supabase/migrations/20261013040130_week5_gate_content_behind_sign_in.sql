-- Caption Drop is members-only from here: signed-out visitors get a landing page
-- at `/` and never reach the gallery, the leaderboard or a single caption.
--
-- The app already enforces that by not querying content on signed-out paths, but
-- the publishable anon key ships inside the browser bundle. Without the policies
-- below, anyone could still read every caption straight from the REST API, so
-- "you have to sign in to see it" would only be true of the UI.
--
-- `voices` is deliberately left public: it is app configuration (which tones the
-- generator offers), not anyone's content, and the landing page names the active
-- ones rather than hardcoding a line-up that could drift.
--
-- `daily_leaderboard` needs no change — it runs with security_invoker, so it
-- returns whatever the reader's own RLS allows, which is now nothing for anon.

-- ── captions ──────────────────────────────────────────────────────────────────
drop policy if exists "captions are publicly readable" on public.captions;
drop policy if exists "members read captions" on public.captions;
create policy "members read captions"
  on public.captions for select
  to authenticated
  using (true);

-- ── images ────────────────────────────────────────────────────────────────────
-- The row carries the Storage path and the photo's dimensions, which is how a
-- caption's photo is found at all.
drop policy if exists "images are publicly readable" on public.images;
drop policy if exists "members read images" on public.images;
create policy "members read images"
  on public.images for select
  to authenticated
  using (true);

-- ── caption_daily_stats ───────────────────────────────────────────────────────
-- Per-day vote tallies behind the leaderboard.
drop policy if exists "daily stats are publicly readable" on public.caption_daily_stats;
drop policy if exists "members read daily stats" on public.caption_daily_stats;
create policy "members read daily stats"
  on public.caption_daily_stats for select
  to authenticated
  using (true);

-- ── profiles ──────────────────────────────────────────────────────────────────
-- Names and avatars of the people who post, shown beside their captions. Gating
-- these keeps the member list out of an anonymous reader's hands too.
drop policy if exists "profiles are publicly readable" on public.profiles;
drop policy if exists "members read profiles" on public.profiles;
create policy "members read profiles"
  on public.profiles for select
  to authenticated
  using (true);
