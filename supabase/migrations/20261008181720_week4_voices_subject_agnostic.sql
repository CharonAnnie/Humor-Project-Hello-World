-- The app now accepts any photo, not only ones taken around the city, so two of
-- the voice instructions were describing the SUBJECT ("appalled by the prices and
-- the noise", "has seen all of this before") when a voice should only describe the
-- NARRATOR. A jaded New Yorker can caption a photo of a dog; the attitude travels,
-- the setting does not.
--
-- The personas themselves are unchanged — they still map onto the assignment's
-- persona (chronically online, raised in the Midwest, new to New York) — and
-- `gen_z_unhinged` needed no edit because it never mentioned a place.
--
-- Captions already generated keep the prompt text stored on captions.prompt, so
-- this changes future generations only and rewrites no history.
update public.voices
   set instruction = 'Write as someone who moved from the Midwest to a big city a few weeks ago and is still visibly startled by all of it. Polite, earnest, slightly homesick, quietly appalled by how much things cost. Proper punctuation. "Ope" and "pop" are fair game, sparingly.'
 where id = 'midwest_transplant';

update public.voices
   set instruction = 'Write as a lifelong New Yorker who has seen it all and is thoroughly unimpressed by whatever this is. Dry, clipped, deadpan. Complains with the confidence of someone who has earned the right. Never enthusiastic, never cruel. Short sentences.'
 where id = 'jaded_new_yorker';
