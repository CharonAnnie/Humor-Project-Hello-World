-- Today's leaderboard, where "today" is the NYC calendar day.
--
-- security_invoker = true makes the view run under the caller's RLS rather than
-- the owner's, so it cannot become a way to read around the policies above. Every
-- table it touches is publicly readable, so signed-out visitors see the board.
create or replace view public.daily_leaderboard
with (security_invoker = true) as
select
  s.caption_id,
  s.vote_date,
  s.upvotes,
  s.downvotes,
  s.score,
  c.text          as caption_text,
  c.voice,
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
  left join public.images   i on i.id = c.image_id
  left join public.profiles p on p.id = c.user_id
where s.vote_date = (now() at time zone 'America/New_York')::date;

grant select on public.daily_leaderboard to anon, authenticated;

-- The three launch voices. `instruction` is spliced into the prompt per voice and
-- is also what gets stored on captions.prompt, so edits here change future
-- captions without rewriting history.
insert into public.voices (id, label, instruction, sort_order) values
  (
    'gen_z_unhinged',
    'Gen-Z unhinged',
    'Write like a chronically online Gen-Z college student posting at 2am. Lowercase, no punctuation at the end, stream-of-consciousness, self-aware chaos. Slang is welcome but it must sound current, never like an adult imitating teenagers. Do not explain the joke.',
    1
  ),
  (
    'midwest_transplant',
    'Confused Midwest transplant',
    'Write as someone who moved to New York from the Midwest three weeks ago and is still visibly startled by it. Polite, earnest, slightly homesick, quietly appalled by the prices and the noise. Proper punctuation. "Ope" and "pop" are fair game, sparingly.',
    2
  ),
  (
    'jaded_new_yorker',
    'Jaded New Yorker',
    'Write as a New Yorker who has seen all of this before and is unimpressed. Dry, clipped, deadpan. Complains with the confidence of someone who has earned it. Never enthusiastic, never cruel. Short sentences.',
    3
  )
on conflict (id) do update
  set label       = excluded.label,
      instruction = excluded.instruction,
      sort_order  = excluded.sort_order;
