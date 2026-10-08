-- Defence in depth behind the RLS policies.
--
-- 1. Trigger functions must not be callable as REST RPCs.
--    Supabase exposes every function in `public` at /rest/v1/rpc/<name>. These are
--    SECURITY DEFINER, so a direct call to bump_caption_counts() with made-up
--    deltas would let anyone with the anon key forge vote totals and own the
--    leaderboard. A trigger fires regardless of EXECUTE grants, so revoking costs
--    nothing. handle_new_user() carried the same exposure since Week 3.
revoke execute on function public.bump_caption_counts(uuid, date, integer, integer) from anon, authenticated, public;
revoke execute on function public.apply_vote_counts()  from anon, authenticated, public;
revoke execute on function public.touch_vote_streak()  from anon, authenticated, public;
revoke execute on function public.touch_updated_at()   from anon, authenticated, public;
revoke execute on function public.handle_new_user()    from anon, authenticated, public;

-- 2. Remove table privileges that no policy grants anyway. RLS is the real gate;
--    this just means a missing policy can never become a write path.
revoke insert, update, delete, truncate on public.caption_daily_stats from anon, authenticated;
revoke insert, update, delete, truncate on public.voices              from anon, authenticated;
revoke update, truncate                on public.captions             from anon, authenticated;
revoke insert, delete, truncate         on public.profiles             from anon, authenticated;
revoke delete, truncate                on public.generations           from anon, authenticated;
revoke truncate                         on public.images               from anon, authenticated;
revoke truncate                         on public.votes                from anon, authenticated;

-- 3. The leaderboard is a read model.
revoke insert, update, delete, truncate on public.daily_leaderboard from anon, authenticated;
