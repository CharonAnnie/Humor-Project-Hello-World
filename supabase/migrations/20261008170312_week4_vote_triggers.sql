-- Vote aggregation and streak bookkeeping.
--
-- These run as SECURITY DEFINER so they can write the public counter tables that
-- RLS makes read-only to clients. `search_path = ''` means every name below is
-- schema-qualified, matching the existing handle_new_user() function.

-- Applies a signed delta to both the all-time counters on the caption and the
-- per-day tallies the leaderboard reads.
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

-- Keeps counters in step with the votes table. Handles a changed vote value and a
-- changed day by reversing the old row before applying the new one.
create or replace function public.apply_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'DELETE' or tg_op = 'UPDATE') then
    perform public.bump_caption_counts(
      old.caption_id,
      old.vote_date,
      case when old.value =  1 then -1 else 0 end,
      case when old.value = -1 then -1 else 0 end
    );
  end if;

  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    perform public.bump_caption_counts(
      new.caption_id,
      new.vote_date,
      case when new.value =  1 then 1 else 0 end,
      case when new.value = -1 then 1 else 0 end
    );
  end if;

  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists votes_apply_counts on public.votes;
create trigger votes_apply_counts
  after insert or update or delete on public.votes
  for each row execute function public.apply_vote_counts();

-- Advances the voting streak on the first vote of a new NYC day.
create or replace function public.touch_vote_streak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last    date;
  v_current integer;
  v_longest integer;
begin
  select last_vote_date, current_streak, longest_streak
    into v_last, v_current, v_longest
    from public.profiles
   where id = new.user_id
     for update;

  -- No profile row (shouldn't happen: handle_new_user creates one) — nothing to do.
  if not found then
    return new;
  end if;

  -- Already counted today, or a backdated vote: leave the streak alone.
  if v_last is not null and new.vote_date <= v_last then
    return new;
  end if;

  if v_last is not null and new.vote_date = v_last + 1 then
    v_current := v_current + 1;
  else
    v_current := 1;
  end if;

  update public.profiles
     set current_streak = v_current,
         longest_streak = greatest(coalesce(v_longest, 0), v_current),
         last_vote_date = new.vote_date,
         updated_at     = now()
   where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists votes_touch_streak on public.votes;
create trigger votes_touch_streak
  after insert on public.votes
  for each row execute function public.touch_vote_streak();

-- Keeps votes.updated_at honest when someone flips their vote.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists votes_touch_updated_at on public.votes;
create trigger votes_touch_updated_at
  before update on public.votes
  for each row execute function public.touch_updated_at();
