-- Matches between videos and games (ADR-0040, GAM-1..4).
-- A video holds matches; a match holds games. Format and players move from the game
-- to the match; side, scores and notes stay on the game. Every existing game becomes
-- its own best-of-1 match.

create table public.matches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  video_id   uuid not null references public.videos on delete cascade,
  best_of    integer check (best_of >= 1),
  format     text not null default 'singles' check (format in ('singles','doubles')),
  opponent   text,
  teammate   text,
  opponent2  text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, video_id),
  constraint matches_singles_no_doubles_players
    check (format = 'doubles' or (teammate is null and opponent2 is null))
);
create index matches_video_id_idx on public.matches (video_id);

create trigger matches_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

alter table public.matches enable row level security;

-- matches: parent video must be the caller's (ADR-0009)
create policy matches_select on public.matches for select to authenticated
  using ((select auth.uid()) = user_id);
create policy matches_insert on public.matches for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
  );
create policy matches_update on public.matches for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
  );
create policy matches_delete on public.matches for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.matches from anon;
grant select, insert, update, delete on public.matches to authenticated;

-- One best-of-1 match per existing game, with the game's format and players.
-- The games trigger is paused so the move does not touch games.updated_at.
alter table public.games add column match_id uuid;
alter table public.games disable trigger games_updated_at;
update public.games set match_id = gen_random_uuid();
alter table public.games enable trigger games_updated_at;

insert into public.matches (id, user_id, video_id, best_of, format, opponent, teammate, opponent2, created_at, updated_at)
select match_id, user_id, video_id, 1, format, opponent, teammate, opponent2, created_at, created_at
from public.games;

alter table public.games
  alter column match_id set not null,
  add constraint games_match_fk foreign key (match_id, video_id)
    references public.matches (id, video_id) on delete cascade,
  drop constraint games_singles_no_doubles_players,
  drop column format,
  drop column opponent,
  drop column teammate,
  drop column opponent2;
create index games_match_id_start_s_idx on public.games (match_id, start_s);

-- games: the match must be the caller's too (the FK keeps it on the same video).
drop policy games_insert on public.games;
drop policy games_update on public.games;
create policy games_insert on public.games for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
    and exists (select 1 from public.matches m where m.id = match_id and m.user_id = (select auth.uid()))
  );
create policy games_update on public.games for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
    and exists (select 1 from public.matches m where m.id = match_id and m.user_id = (select auth.uid()))
  );

-- Video list summary gains the match count (appended: create or replace keeps column order).
create or replace view public.video_summaries with (security_invoker = true) as
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
          where j.video_id = v.id and j.status in ('queued','downloading','analyzing')) as job_running,
  (select count(*)::int from public.matches m where m.video_id = v.id) as match_count
from public.videos v;
