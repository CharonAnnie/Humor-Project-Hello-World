-- Row Level Security on every table in `public`.
--
-- Shape of the rules:
--   * Anything needed to render the public gallery and leaderboard is world-readable.
--   * Anything a user authors is writable only by that user.
--   * Prompts, raw model responses and individual vote rows are private to their owner.
--   * Counter tables have no write policy at all: only the SECURITY DEFINER vote
--     triggers touch them, which is what keeps scores honest.
--
-- auth.uid() is wrapped in a scalar subquery so Postgres evaluates it once per
-- statement instead of once per row.

alter table public.profiles            enable row level security;
alter table public.images              enable row level security;
alter table public.captions            enable row level security;
alter table public.generations         enable row level security;
alter table public.votes               enable row level security;
alter table public.caption_daily_stats enable row level security;
alter table public.voices              enable row level security;

-- ── profiles ──────────────────────────────────────────────────────────────────
-- Readable by anyone: the gallery and leaderboard credit captions to a name and
-- avatar. The table holds no email or other contact detail.
-- No INSERT policy: handle_new_user() is SECURITY DEFINER and bypasses RLS.
-- No DELETE policy: profiles die with their auth.users row via ON DELETE CASCADE.
drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ── images ────────────────────────────────────────────────────────────────────
-- Public gallery, so reads are open. Writes are confined to your own rows.
drop policy if exists "images are publicly readable" on public.images;
create policy "images are publicly readable"
  on public.images for select
  to anon, authenticated
  using (true);

drop policy if exists "users upload own images" on public.images;
create policy "users upload own images"
  on public.images for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "users update own images" on public.images;
create policy "users update own images"
  on public.images for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "users delete own images" on public.images;
create policy "users delete own images"
  on public.images for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ── captions ──────────────────────────────────────────────────────────────────
-- Readable by anyone (logged-out visitors browse and read prompts).
-- Insertable only as yourself, and only against a generation you own — that stops
-- a caption being attributed to someone else's Gemini call.
-- No UPDATE policy: vote counters are written by the trigger, and caption text is
-- model output that should not be editable after the fact.
drop policy if exists "captions are publicly readable" on public.captions;
create policy "captions are publicly readable"
  on public.captions for select
  to anon, authenticated
  using (true);

drop policy if exists "users insert own captions" on public.captions;
create policy "users insert own captions"
  on public.captions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.generations g
       where g.id = generation_id
         and g.user_id = (select auth.uid())
    )
  );

drop policy if exists "users delete own captions" on public.captions;
create policy "users delete own captions"
  on public.captions for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ── generations ───────────────────────────────────────────────────────────────
-- Private. Holds the system instruction, the prompt and the raw model response.
-- The per-caption prompt is republished on captions.prompt for public display.
drop policy if exists "users read own generations" on public.generations;
create policy "users read own generations"
  on public.generations for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users insert own generations" on public.generations;
create policy "users insert own generations"
  on public.generations for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Needed to move the row from 'pending' to 'succeeded'/'failed' after the call.
drop policy if exists "users update own generations" on public.generations;
create policy "users update own generations"
  on public.generations for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── votes ─────────────────────────────────────────────────────────────────────
-- A vote row is visible only to the person who cast it, so nobody can audit who
-- downvoted them. Public totals come from captions.score and caption_daily_stats.
-- `anon` has no policy here at all, which is how logged-out visitors are blocked
-- from voting at the database level rather than only in the UI.
drop policy if exists "users read own votes" on public.votes;
create policy "users read own votes"
  on public.votes for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users cast own votes" on public.votes;
create policy "users cast own votes"
  on public.votes for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "users change own votes" on public.votes;
create policy "users change own votes"
  on public.votes for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "users retract own votes" on public.votes;
create policy "users retract own votes"
  on public.votes for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ── caption_daily_stats ───────────────────────────────────────────────────────
-- Read-only to the world; written only by the vote triggers.
drop policy if exists "daily stats are publicly readable" on public.caption_daily_stats;
create policy "daily stats are publicly readable"
  on public.caption_daily_stats for select
  to anon, authenticated
  using (true);

-- ── voices ────────────────────────────────────────────────────────────────────
-- Retired voices stay in the table for old captions but disappear from the API.
drop policy if exists "active voices are publicly readable" on public.voices;
create policy "active voices are publicly readable"
  on public.voices for select
  to anon, authenticated
  using (is_active);
