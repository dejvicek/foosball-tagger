-- Initial schema (PRD §5), with the deviations recorded in ADR.md:
--   ADR-0002  possessions.setup is nullable
--   ADR-0009  child rows check that the parent belongs to the same user
--   ADR-0013  videos.aspect_ratio; video_summaries view for the video list
-- All times are seconds from the start of the YouTube video.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.videos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  youtube_id   text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title        text,
  duration_s   numeric check (duration_s >= 0),
  aspect_ratio numeric check (aspect_ratio > 0),                -- width / height of the video frame
  fps          integer not null default 30 check (fps in (30, 60)),
  recorded_on  date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, youtube_id)
);

create table public.games (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  video_id     uuid not null references public.videos on delete cascade,
  start_s      numeric not null check (start_s >= 0),
  end_s        numeric,
  my_side      text not null check (my_side in ('left','right')),
  format       text not null default 'singles' check (format in ('singles','doubles')),
  opponent     text,
  my_score     integer check (my_score >= 0),
  opp_score    integer check (opp_score >= 0),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_s is null or end_s > start_s)
);
create index games_video_id_start_s_idx on public.games (video_id, start_s);

-- Four playfield corners in normalized video coordinates (0..1), clockwise starting
-- at the corner nearest the user's goal on the left of the frame.
create table public.calibrations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  video_id   uuid not null references public.videos on delete cascade,
  game_id    uuid references public.games on delete cascade,   -- null = whole video; set if the camera moved
  points     jsonb not null check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) = 4),
  frame_s    numeric,                                            -- video time of the frame used
  created_at timestamptz not null default now()
);
create index calibrations_video_id_idx on public.calibrations (video_id);
create index calibrations_game_id_idx on public.calibrations (game_id);

create table public.possessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  game_id       uuid not null references public.games on delete cascade,
  start_s       numeric,
  shot_s        numeric,                                         -- end time for 'No shot' (ADR-0010)
  setup         text check (setup in ('Middle','Pull side','Push side')),
  shot_type     text check (shot_type in ('Pin','Pull','Other','No shot')),
  direction     text check (direction in ('Pull','Push','Straight')),
  hole          text check (hole in ('Pull-side lane','Middle lane','Push-side lane')),
  result        text check (result in ('Goal','No goal')),
  execution     text check (execution in ('Proper','Misexecuted')),
  source        text not null default 'manual' check (source in ('manual','auto')),
  confidence    numeric check (confidence between 0 and 1),
  review_status text not null default 'confirmed' check (review_status in ('unreviewed','confirmed','rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (start_s is null or shot_s is null or shot_s >= start_s),
  check (shot_type is distinct from 'No shot'
         or (direction is null and hole is null and result is null and execution is null))
);
create index possessions_game_id_start_s_idx on public.possessions (game_id, start_s);

-- Requests for the offline worker (PRD §9). Created by the app, consumed by the worker.
create table public.analysis_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  video_id     uuid not null references public.videos on delete cascade,
  game_id      uuid references public.games on delete cascade,   -- null = all games on the video
  status       text not null default 'queued' check (status in ('queued','downloading','analyzing','done','failed')),
  progress     numeric check (progress between 0 and 1),
  message      text,
  candidates   integer,
  requested_at timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
create index analysis_jobs_video_id_idx on public.analysis_jobs (video_id);
create index analysis_jobs_game_id_idx on public.analysis_jobs (game_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger videos_updated_at before update on public.videos
  for each row execute function public.set_updated_at();
create trigger games_updated_at before update on public.games
  for each row execute function public.set_updated_at();
create trigger possessions_updated_at before update on public.possessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (PRD §5, ADR-0009)
-- Policies are per command: insert has only WITH CHECK, select/delete only USING.
-- Foreign-key checks bypass RLS, so inserts and updates of child rows also check
-- that the parent row belongs to the caller.
-- ---------------------------------------------------------------------------

alter table public.videos        enable row level security;
alter table public.games         enable row level security;
alter table public.calibrations  enable row level security;
alter table public.possessions   enable row level security;
alter table public.analysis_jobs enable row level security;

-- videos
create policy videos_select on public.videos for select to authenticated
  using ((select auth.uid()) = user_id);
create policy videos_insert on public.videos for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy videos_update on public.videos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy videos_delete on public.videos for delete to authenticated
  using ((select auth.uid()) = user_id);

-- games: parent video must be the caller's
create policy games_select on public.games for select to authenticated
  using ((select auth.uid()) = user_id);
create policy games_insert on public.games for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
  );
create policy games_update on public.games for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
  );
create policy games_delete on public.games for delete to authenticated
  using ((select auth.uid()) = user_id);

-- calibrations: parent video must be the caller's; an optional game must be the caller's and on that video
create policy calibrations_select on public.calibrations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy calibrations_insert on public.calibrations for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
    and (game_id is null or exists (
      select 1 from public.games g
      where g.id = game_id and g.video_id = calibrations.video_id and g.user_id = (select auth.uid())))
  );
create policy calibrations_update on public.calibrations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
    and (game_id is null or exists (
      select 1 from public.games g
      where g.id = game_id and g.video_id = calibrations.video_id and g.user_id = (select auth.uid())))
  );
create policy calibrations_delete on public.calibrations for delete to authenticated
  using ((select auth.uid()) = user_id);

-- possessions: parent game must be the caller's
create policy possessions_select on public.possessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy possessions_insert on public.possessions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.games g where g.id = game_id and g.user_id = (select auth.uid()))
  );
create policy possessions_update on public.possessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.games g where g.id = game_id and g.user_id = (select auth.uid()))
  );
create policy possessions_delete on public.possessions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- analysis_jobs: parent video must be the caller's; an optional game must be the caller's and on that video
create policy analysis_jobs_select on public.analysis_jobs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy analysis_jobs_insert on public.analysis_jobs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
    and (game_id is null or exists (
      select 1 from public.games g
      where g.id = game_id and g.video_id = analysis_jobs.video_id and g.user_id = (select auth.uid())))
  );
create policy analysis_jobs_update on public.analysis_jobs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
    and (game_id is null or exists (
      select 1 from public.games g
      where g.id = game_id and g.video_id = analysis_jobs.video_id and g.user_id = (select auth.uid())))
  );
create policy analysis_jobs_delete on public.analysis_jobs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Video list summary (VID-2, VID-3). security_invoker makes the view apply the
-- caller's RLS on every underlying table.
-- ---------------------------------------------------------------------------

create view public.video_summaries with (security_invoker = true) as
select
  v.*,
  (select count(*)::int from public.games g where g.video_id = v.id) as game_count,
  (select count(*)::int from public.possessions p join public.games g on g.id = p.game_id
     where g.video_id = v.id and p.review_status = 'confirmed') as confirmed_possession_count,
  (select count(*)::int from public.possessions p join public.games g on g.id = p.game_id
     where g.video_id = v.id) as possession_count,
  (select count(*)::int from public.calibrations c where c.video_id = v.id) as calibration_count,
  (select count(*)::int from public.analysis_jobs j where j.video_id = v.id) as job_count,
  exists (select 1 from public.analysis_jobs j
          where j.video_id = v.id and j.status in ('queued','downloading','analyzing')) as job_running
from public.videos v;

-- ---------------------------------------------------------------------------
-- Grants: only signed-in users reach the data; anon gets nothing.
-- ---------------------------------------------------------------------------

revoke all on public.videos, public.games, public.calibrations, public.possessions,
  public.analysis_jobs, public.video_summaries from anon;
grant select, insert, update, delete on public.videos, public.games, public.calibrations,
  public.possessions, public.analysis_jobs to authenticated;
grant select on public.video_summaries to authenticated;
