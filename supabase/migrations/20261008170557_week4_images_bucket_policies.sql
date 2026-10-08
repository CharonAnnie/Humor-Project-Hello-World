-- The `images` bucket had no policies at all: the Week 3 seed images were pushed
-- with a secret key, so nothing ever needed them. User uploads go through the
-- browser with the anon key, so they need the same own-folder rules as `avatars`.
--
-- Every upload path starts with the uploader's user id: "<uid>/drop-<ts>.jpg".
-- The Week 3 seed objects under "seed/" stay readable because the bucket is public.

drop policy if exists "image read" on storage.objects;
create policy "image read"
  on storage.objects for select
  to public
  using (bucket_id = 'images');

drop policy if exists "image upload own folder" on storage.objects;
create policy "image upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "image update own folder" on storage.objects;
create policy "image update own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "image delete own folder" on storage.objects;
create policy "image delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
