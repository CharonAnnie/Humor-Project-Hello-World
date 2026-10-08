-- captions.user_id pointed at auth.users, which PostgREST will not embed, so
-- rendering "who generated this" needed a second round trip and a manual join.
-- profiles.id is itself a FK to auth.users(id) with ON DELETE CASCADE, so
-- repointing at the public identity table keeps the same guarantee and lets the
-- gallery select captions, their image, their voice and their author in one query.
alter table public.captions
  drop constraint if exists captions_user_id_fkey;

alter table public.captions
  add constraint captions_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;
