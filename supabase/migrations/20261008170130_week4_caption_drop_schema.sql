-- Week 4: AI caption generation, voting, daily leaderboard, streaks.
-- Additive only: every new column on an existing table is nullable or defaulted,
-- so the Week 3 seed rows (14 images, 15 captions) stay valid.

-- Voice personas. In the database rather than in code so a new voice is a row,
-- not a deploy. `instruction` is the fragment spliced into the prompt.
create table if not exists public.voices (
  id          text primary key,
  label       text    not null,
  instruction text    not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- One row per Gemini call. Holds the call-level prompt and the raw response so a
-- bad caption can be traced back to exactly what was sent.
create table if not exists public.generations (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  image_id           uuid not null references public.images (id) on delete cascade,
  model              text not null,
  system_instruction text not null,
  user_prompt        text not null,
  response_schema    jsonb,
  raw_response       jsonb,
  status             text not null default 'pending'
                       check (status in ('pending', 'succeeded', 'failed')),
  error_message      text,
  input_tokens       integer,
  output_tokens      integer,
  latency_ms         integer,
  created_at         timestamptz not null default now(),
  completed_at       timestamptz
);

create index if not exists generations_user_id_created_at_idx
  on public.generations (user_id, created_at desc);
create index if not exists generations_image_id_idx
  on public.generations (image_id);

-- Who uploaded an image. Null means a Week 3 seed image with no owner.
alter table public.images
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists images_user_id_idx on public.images (user_id);

-- Caption provenance and denormalised vote counters.
-- `prompt` is the fully rendered prompt for THIS caption's voice: one API call
-- produces all three voices, so the per-voice prompt is recorded per row rather
-- than only on `generations`.
alter table public.captions
  add column if not exists user_id       uuid references auth.users (id) on delete set null,
  add column if not exists generation_id uuid references public.generations (id) on delete cascade,
  add column if not exists voice         text references public.voices (id),
  add column if not exists prompt        text,
  add column if not exists model         text,
  add column if not exists upvotes       integer not null default 0,
  add column if not exists downvotes     integer not null default 0;

-- Counters are trigger-maintained, so score is derived rather than stored twice.
alter table public.captions
  add column if not exists score integer
    generated always as (upvotes - downvotes) stored;

create index if not exists captions_user_id_idx       on public.captions (user_id);
create index if not exists captions_generation_id_idx on public.captions (generation_id);
create index if not exists captions_score_idx         on public.captions (score desc, created_at desc);

-- One vote per user per caption; changing your mind updates `value`.
-- vote_date is the NYC calendar day, which is what "daily" means for this product.
create table if not exists public.votes (
  id         uuid primary key default gen_random_uuid(),
  caption_id uuid     not null references public.captions (id) on delete cascade,
  user_id    uuid     not null references auth.users (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  vote_date  date     not null default (now() at time zone 'America/New_York')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (caption_id, user_id)
);

create index if not exists votes_caption_id_idx          on public.votes (caption_id);
create index if not exists votes_user_id_vote_date_idx   on public.votes (user_id, vote_date desc);

-- Per-caption, per-day tallies. This table exists so the leaderboard can be read
-- by anyone while the raw `votes` rows stay private to their owner under RLS.
create table if not exists public.caption_daily_stats (
  caption_id uuid    not null references public.captions (id) on delete cascade,
  vote_date  date    not null,
  upvotes    integer not null default 0,
  downvotes  integer not null default 0,
  score      integer generated always as (upvotes - downvotes) stored,
  primary key (caption_id, vote_date)
);

create index if not exists caption_daily_stats_vote_date_score_idx
  on public.caption_daily_stats (vote_date desc, score desc);

-- Voting streak, counted in NYC days.
alter table public.profiles
  add column if not exists current_streak integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists last_vote_date date;
