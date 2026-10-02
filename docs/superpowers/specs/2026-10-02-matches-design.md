# Matches: video → matches → games

Date: 2026-10-02 · Status: proposed · Will be recorded as ADR-0040 (supersedes parts of the PRD's §4 glossary, §5 schema, GAM-1..4, STA-4 and EXP-1).

## Goal

A video holds 1..X **matches**; a match holds 1..Y **games**. Today a video holds games directly and each game carries its own format and players. Matches are mostly BO1, BO3 or BO5, but any "best of" must work.

## Decisions (agreed with the user)

| # | Decision |
|---|----------|
| 1 | Match holds: `best_of`, `format`, `opponent`, `teammate`, `opponent2`, `notes`. Game keeps: `start_s`, `end_s`, `my_side`, `my_score`, `opp_score`, `notes`. Sides switch between games, so `my_side` stays per game. |
| 2 | `best_of` is an optional integer ≥ 1, no upper limit, even values allowed (BO2 can be a draw). Null = format not stated. |
| 3 | Migration: every existing game becomes its own match with `best_of = 1` (all tagged matches so far are BO1). |
| 4 | No moving games between matches and no merging matches. |
| 5 | A match has no times of its own; its range is the span of its games. |
| 6 | Statistics get a match scope; CSV gets `match_index` and `best_of`; `game_index` becomes the number within the match. |
| 7 | An empty match (no games) is allowed. |
| 8 | Game and match each have their own notes. |

## 1. Schema — `supabase/migrations/0006_matches.sql`

```sql
create table matches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  video_id   uuid not null references videos on delete cascade,
  best_of    integer check (best_of >= 1),
  format     text not null default 'singles' check (format in ('singles','doubles')),
  opponent   text,
  teammate   text,
  opponent2  text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, video_id),
  check (format = 'doubles' or (teammate is null and opponent2 is null))
);
```

- `updated_at` trigger, RLS per command with the parent-owner check on `video_id` (ADR-0009), grants as for the other tables, revoke from anon.
- `games`: add `match_id uuid not null`, with `foreign key (match_id, video_id) references matches (id, video_id) on delete cascade`, so a game's video always equals its match's video. `games.video_id` stays (calibrations, jobs, RLS and existing queries use it). Games' RLS insert/update checks additionally require the match to belong to the user.
- Data step, in the same migration: insert one match per game (same `user_id`, `video_id`, `format`, `opponent`, `teammate`, `opponent2`; `best_of = 1`; `notes` null; `created_at` = the game's), set `games.match_id`, then add the not-null and FK.
- Drop from `games`: `format`, `opponent`, `teammate`, `opponent2`, and the `games_singles_no_doubles_players` check. Game `notes` stay on the game.
- `video_summaries` is recreated with an added `match_count`.
- Index on `games (match_id, start_s)`.
- Calibrations, possessions and analysis jobs are unchanged.
- PGlite test `supabase/tests/matches.test.ts`: migration of existing games (one BO1 match each, players copied), FK video consistency, cascade match → games → possessions, RLS (another user's match cannot be used), `best_of` check, the singles/doubles check on matches, `match_count` in the view.

## 2. Data layer

- `src/data/types.ts`: `Match` type; `Game` loses the player fields and gains `match_id`; `Format` moves with it. `Database` typing gets `matches`.
- `src/data/matches.ts`: `loadMatches(queue, videoId)`, `saveMatch`, `deleteMatch` (cascades queued games and their possessions), mirroring `games.ts`.
- `src/data/queue.ts`: `QueueTable` gains `matches` with rank 0 (games 1, possessions 2). Deleting a match drops queued writes of its games and of those games' possessions (the cascade becomes two-level). Matches are tagging writes and go through the queue (SYN-1..4).

## 3. Video screen

- **Current match:** the match selected in the panel; by default the last match on the video (latest by its first game's start, empty matches by creation order).
- **B** starts a game in the current match. On a video with no match, B first creates one (format singles, other fields blank). First-game side prompt and side/format carry-over of ADR-0017 stay; the game's side comes from the previous game on the video.
- **M** (video screen only) and a "New match" button create a new, empty match that becomes current, copying `format`, `opponent`, `teammate`, `opponent2` and `best_of` from the previous match. If a game is open, it is closed at the current time first, as B does today.
- **E** unchanged.
- **Overlap rules:** games still may not overlap (GAM-4). Matches may not interleave: a game's range may not lie between the first start and last end of another match, and a boundary edit may not make it so. Refused with a message naming the match and times, like today.
- **Panel:** games grouped under match headers, in time order. Header: "Match n", format switch and players (edited inline, as now for games), best-of field, match notes, result derived from the game scores: "2–1" plus "· BO3" when set, and "decided" once a side has more than `best_of / 2` game wins. Games with missing scores don't count toward the result. A game added past `best_of` shows a warning ("BO3 already has 3 games"), never a block.
- **Delete match:** confirmation stating game and possession counts. Deleting the last game of a match leaves the empty match.
- Video list (VID-2) shows match count next to game count.

## 4. Tagging screen

Scoped to one game as now. The header label becomes "Match 2 · Game 1 · vs A" (or "with T · vs A & B" for doubles). Nothing else changes.

## 5. Statistics and export

- `src/data/stats.ts` loads matches with games; the pure `stats/` functions receive the match fields with each game (joined in the data layer), so `stats/` stays free of Supabase.
- **STA-4 scopes:** game, **match**, video, date range. The match selector lists matches of the chosen video. Format and opponent filters read from the match; opponent filter matches either opponent of a doubles match (ADR-0023). Scope lives in the URL (`#/stats?match=<id>`).
- **EXP-1 columns:** the current `EXPORT_COLUMNS` with `match_index, best_of` inserted before `game_index`: `video_title, recorded_on, youtube_id, match_index, best_of, game_index, opponent, format, my_side, n, start_s, shot_s, length_s, setup, shot_type, movement, hole, shot_direction, result, execution, source`. `opponent` and `format` come from the match. `match_index` is 1-based within the video, `game_index` 1-based within the match, `best_of` empty when null.

## 6. Docs and tests

- `ADR.md`: ADR-0040 with these decisions, citing what it supersedes.
- Unit tests: match grouping and result/decided logic (`src/videos/matches.test.ts`), interleave refusal, queue rank and two-level cascade, CSV columns, stats match scope and filters, VideoPage M/B behaviour.
- `docs/manual-tests.md`: mark two matches with M/B/E on one video, check grouping, result, BO warning, delete-match confirmation, offline marking then reconnect.
- User runs `npx supabase db push` after merge.

## Out of scope

Moving games between matches, merging or splitting matches, match-level times, tournaments/events.
