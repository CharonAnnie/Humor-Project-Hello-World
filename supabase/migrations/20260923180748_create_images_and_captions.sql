create table public.images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  file_name text,
  mime_type text,
  width integer,
  height integer,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table public.captions (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.images (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create index captions_image_id_idx on public.captions (image_id);

alter table public.images disable row level security;
alter table public.captions disable row level security;
