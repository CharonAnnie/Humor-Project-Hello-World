-- The launch voices were personas tied to a place ("Confused Midwest transplant",
-- "Jaded New Yorker"), which only read as funny when the photo was of a city. The
-- app now takes any photo, so the voices become general TONES instead: a tone
-- works on a dog, a sandwich or a skyline.
--
-- The old rows are retired, not deleted: captions.voice is a foreign key to this
-- table, so dropping them would either fail or strip the provenance from captions
-- that were already generated. Retired rows stay readable (see
-- week4_voices_readable_when_retired), so an existing caption keeps showing the
-- voice that actually wrote it, while the picker only offers active rows.
update public.voices
   set is_active = false
 where id in ('gen_z_unhinged', 'midwest_transplant', 'jaded_new_yorker');

-- Three tones chosen to spread across the emotional range rather than crowd one
-- corner of it — mean, kind, chaotic — so there is something real to vote between.
insert into public.voices (id, label, instruction, sort_order, is_active) values
  (
    'sarcastic',
    'Sarcastic',
    'Write with heavy irony. Either praise something that plainly does not deserve praise, or state the opposite of what you obviously mean, and trust the reader to catch it. Dry and cutting about the situation, never cruel about a person. Proper punctuation.',
    1,
    true
  ),
  (
    'wholesome',
    'Wholesome',
    'Write with complete sincerity. Find the small, genuinely lovely thing in the photo and say it plainly and warmly. No irony, no winking, no joke at anyone''s expense. Earnest and a little soft-hearted.',
    2,
    true
  ),
  (
    'unhinged',
    'Unhinged',
    'Write like someone chronically online posting at 2am. Lowercase, no punctuation at the end, stream-of-consciousness, self-aware chaos. Slang is welcome but it must sound current, never like an adult imitating teenagers. Do not explain the joke.',
    3,
    true
  )
on conflict (id) do update
  set label       = excluded.label,
      instruction = excluded.instruction,
      sort_order  = excluded.sort_order,
      is_active   = excluded.is_active;
