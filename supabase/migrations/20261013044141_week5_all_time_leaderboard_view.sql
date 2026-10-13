-- The all-time board, as a companion to `daily_leaderboard` so the page can
-- toggle between them without a second render path: same column names, same
-- ordering contract, so only the view name changes at the call site.
--
-- It reads `captions.upvotes/downvotes/score` — the running totals the vote
-- trigger maintains — rather than summing `caption_daily_stats`, which is both
-- cheaper and the authoritative number for a caption's lifetime score.
--
-- `where upvotes + downvotes > 0` mirrors the daily board, which can only list
-- captions that were voted on that day. A caption nobody has ever voted on has
-- no standing on a leaderboard, and without this filter the board would be a
-- list of every caption ever written, tied at zero and ordered by age.
--
-- security_invoker = true keeps it running under the caller's RLS, so it can't
-- become a way to read around the members-only policies on captions, images and
-- profiles.
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
  left join public.profiles p on p.id = c.user_id
where c.upvotes + c.downvotes > 0;

-- Anon is left off the grant: the board is behind sign-in now, and RLS would
-- return nothing anyway.
grant select on public.all_time_leaderboard to authenticated;
revoke insert, update, delete, truncate on public.all_time_leaderboard from anon, authenticated;
