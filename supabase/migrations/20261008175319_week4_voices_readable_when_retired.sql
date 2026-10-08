-- The previous policy was `using (is_active)`, which hid a retired voice from
-- everyone. Captions keep a FK to the voice that wrote them, and both the gallery
-- chip and the leaderboard's voice_label read the label through that join — so
-- retiring a voice silently blanked the style on every caption that had used it.
--
-- Rows in this table are labels and prompt fragments, not user data, so all of
-- them are readable. `is_active` is a curation flag for which voices are OFFERED,
-- and the queries that build the picker filter on it instead.
drop policy if exists "active voices are publicly readable" on public.voices;
drop policy if exists "voices are publicly readable" on public.voices;

create policy "voices are publicly readable"
  on public.voices for select
  to anon, authenticated
  using (true);
