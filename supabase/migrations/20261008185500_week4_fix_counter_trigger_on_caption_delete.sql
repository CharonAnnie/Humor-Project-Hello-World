-- Bug: deleting a caption that had any votes failed outright.
--
-- Deleting a caption cascades to its votes, and apply_vote_counts() then runs
-- once per removed vote. The ON CONFLICT insert below would recreate a
-- caption_daily_stats row keyed to a caption that no longer exists, which
-- caption_daily_stats_caption_id_fkey rejects — aborting the delete. Verified:
-- deleting a voted-on caption failed, while deleting its vote first and then the
-- caption succeeded.
--
-- When the caption is already gone there are no counters left to maintain, so the
-- function bails out. The cascade removes the caption's own counters and stats.
create or replace function public.bump_caption_counts(
  p_caption_id uuid,
  p_vote_date  date,
  p_up_delta   integer,
  p_down_delta integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The caption is mid-delete and its rows are cascading away. Nothing to do.
  if not exists (select 1 from public.captions where id = p_caption_id) then
    return;
  end if;

  update public.captions
     set upvotes   = greatest(0, upvotes   + p_up_delta),
         downvotes = greatest(0, downvotes + p_down_delta)
   where id = p_caption_id;

  insert into public.caption_daily_stats (caption_id, vote_date, upvotes, downvotes)
  values (p_caption_id, p_vote_date, greatest(0, p_up_delta), greatest(0, p_down_delta))
  on conflict (caption_id, vote_date) do update
     set upvotes   = greatest(0, public.caption_daily_stats.upvotes   + p_up_delta),
         downvotes = greatest(0, public.caption_daily_stats.downvotes + p_down_delta);
end;
$$;

-- Recreated above, so re-apply the hardening from
-- week4_harden_grants_and_functions: this must never be callable as a REST RPC.
revoke execute on function public.bump_caption_counts(uuid, date, integer, integer)
  from anon, authenticated, public;
