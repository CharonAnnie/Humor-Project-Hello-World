-- The view handed out `voice` as a raw id, which meant every consumer had to
-- fetch the voices table just to print "Jaded New Yorker". Join it here instead.
-- CREATE OR REPLACE cannot add columns, so the view is dropped first.
drop view if exists public.daily_leaderboard;

create view public.daily_leaderboard
with (security_invoker = true) as
select
  s.caption_id,
  s.vote_date,
  s.upvotes,
  s.downvotes,
  s.score,
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
  rank() over (order by s.score desc, c.created_at asc) as rank
from public.caption_daily_stats s
  join public.captions c on c.id = s.caption_id
  left join public.voices   v on v.id = c.voice
  left join public.images   i on i.id = c.image_id
  left join public.profiles p on p.id = c.user_id
where s.vote_date = (now() at time zone 'America/New_York')::date;

grant select on public.daily_leaderboard to anon, authenticated;
revoke insert, update, delete, truncate on public.daily_leaderboard from anon, authenticated;
