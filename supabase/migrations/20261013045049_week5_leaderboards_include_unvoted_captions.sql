-- Both boards now list every caption, including the ones nobody has voted on.
--
-- This reverses the `upvotes + downvotes > 0` filter added one migration ago:
-- the board is meant to be the whole field with its current standings, not only
-- the captions that have already scored. A caption sitting at 0 is exactly what
-- a voter should be able to find and vote on.
--
-- `daily_leaderboard` had the same gap for a different reason: it was driven by
-- `caption_daily_stats`, which only has a row once a caption is voted on, on the
-- day it was voted. So it is rebuilt to start from `captions` and LEFT JOIN
-- today's stats, with the counters coalesced to 0. "Today's score" therefore
-- means votes cast today — everyone starts the Eastern day at zero — while the
-- board still lists the full field.
--
-- CREATE OR REPLACE cannot reorder or retype columns, so the daily view is
-- dropped and recreated. The column list is unchanged, which is what lets the
-- page treat the two views interchangeably.
drop view if exists public.daily_leaderboard;

create view public.daily_leaderboard
with (security_invoker = true) as
select
  c.id            as caption_id,
  (now() at time zone 'America/New_York')::date as vote_date,
  coalesce(s.upvotes, 0)   as upvotes,
  coalesce(s.downvotes, 0) as downvotes,
  coalesce(s.score, 0)     as score,
  c.text          as caption_text,
  c.voice,
  v.label         as voice_label,
  c.prompt,
  c.created_at    as caption_created_at,
  c.image_id,
  c.user_id       as author_id,
  i.storage_path,
  i.width         as image_width,
  i.height        as image_height,
  p.first_name    as author_first_name,
  p.last_name     as author_last_name,
  p.avatar_url    as author_avatar_url,
  rank() over (order by coalesce(s.score, 0) desc, c.created_at asc) as rank
from public.captions c
  -- Joined on today's date, so a caption with no votes today still appears, at 0.
  left join public.caption_daily_stats s
         on s.caption_id = c.id
        and s.vote_date = (now() at time zone 'America/New_York')::date
  left join public.voices   v on v.id = c.voice
  left join public.images   i on i.id = c.image_id
  left join public.profiles p on p.id = c.user_id;

-- Anon is left off the grant now that the board is behind sign-in. RLS would
-- return nothing to it anyway; this just fails earlier and more clearly.
grant select on public.daily_leaderboard to authenticated;
revoke insert, update, delete, truncate on public.daily_leaderboard from anon, authenticated;

-- Same view as the previous migration, minus the filter.
create or replace view public.all_time_leaderboard
with (security_invoker = true) as
select
  c.id            as caption_id,
  c.upvotes,
  c.downvotes,
  c.score,
  c.text          as caption_text,
  c.voice,
  v.label         as voice_label,
  c.prompt,
  c.created_at    as caption_created_at,
  c.image_id,
  c.user_id       as author_id,
  i.storage_path,
  i.width         as image_width,
  i.height        as image_height,
  p.first_name    as author_first_name,
  p.last_name     as author_last_name,
  p.avatar_url    as author_avatar_url,
  rank() over (order by c.score desc, c.created_at asc) as rank
from public.captions c
  left join public.voices   v on v.id = c.voice
  left join public.images   i on i.id = c.image_id
  left join public.profiles p on p.id = c.user_id;

grant select on public.all_time_leaderboard to authenticated;
revoke insert, update, delete, truncate on public.all_time_leaderboard from anon, authenticated;
