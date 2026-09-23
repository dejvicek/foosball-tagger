# Foosball Session Tagger — Product Requirements

Version 1.0 · September 2026

## 1. Summary

A single-user web app for tagging recorded foosball games possession by possession and turning the tags into statistics that guide practice. Videos are YouTube recordings of practice sessions (uploads or live-stream archives); one video usually contains several games. The app is hosted on GitHub Pages; data lives in Supabase.

A working single-file prototype lives at `reference/foosball-tagger-v1.html`. It is the behavioral reference for the tagging flow, keyboard scheme, timeline, log and statistics unless this document says otherwise. Its storage layer (browser localStorage) and video source (local files) are not carried over.

### 1.1 Product direction

- **MVP (this build):** the user pastes a YouTube URL, marks where each game starts and ends, and tags possessions manually with the keyboard while the video plays in an embedded YouTube player.
- **Target (later, separate component):** the user marks the four corners of the playfield once per video; an offline worker then detects possessions on the user's 3-bar automatically and writes them as *candidates* that the user confirms or corrects in the same UI. The MVP stores everything the worker will need (games, sides, calibration) and models possessions so manual and automatic ones coexist. See §9.

### 1.2 Goals

1. Tag a game quickly, mostly from the keyboard, at roughly real-time speed.
2. Store videos, games, calibrations and possessions durably, available from any device.
3. Show statistics per game, per video and across time, honestly: every percentage shows its sample size, and blank fields never count as failures.
4. Export any selection of games as CSV to paste into a coaching conversation.

### 1.3 Non-goals

- No video upload, download, processing or storage in the web app. Playback is always the YouTube embed. Any file handling happens in the separate worker (§9).
- No computer vision in the browser; it is impossible against a YouTube embed (§9.1).
- No multi-user features beyond what Supabase auth provides.
- No mobile-first design. Must be usable on a phone (tap everything), but the primary device is a laptop with a keyboard.

### 1.4 Success criteria for the MVP

- Tagging a 10-minute game takes no more than about 15 minutes of wall-clock time.
- No tag is ever lost, including when the network drops mid-session.
- Every statistic in the UI can be recomputed from the CSV export by hand and matches.

## 2. Glossary

| Term | Meaning |
|---|---|
| Video | One YouTube video, identified by its YouTube id. |
| Game | A time range within a video during which one foosball game was played. |
| Possession | A period in which the user has the ball on their 3-bar (offensive rod), ending with a shot or a loss of the ball. |
| Draft | The possession currently being tagged, not yet saved. |
| Candidate | A possession produced by the automatic worker, awaiting review. |
| Setup | Where the ball sits when the possession starts: Middle, Pull side, Push side. |
| Shot type | Shot family: Pin, Pull, Other, or No shot. |
| Direction | Lateral movement of the ball from the setup before the shot: Pull, Push, Straight. |
| Hole | Lane of the goal the ball crossed or was aimed at, seen from the shooter: Pull-side lane, Middle lane, Push-side lane. |
| Execution | Proper or Misexecuted, judged against criteria the player defines before tagging. |
| my_side | The side of the video frame the user's own goal is on: left or right. |

Why fixed lanes instead of long/short: long and short are relative to the setup and are meaningless for straight shots. Fixed lanes describe where the goalie was beaten; long/short can be derived from setup + direction + hole when needed.

## 3. Users and context

One user: the player, who is also the coach's client. They tag their own games after practice, usually on a laptop, sometimes reviewing statistics on a phone. They paste CSV exports into a coaching conversation with an AI, so exports must be plain, complete and self-describing.

## 4. Technical constraints

### 4.1 Stack

- Vite + React + TypeScript.
- YouTube IFrame Player API for playback. Load `https://www.youtube.com/iframe_api` directly and type the player; do not use a wrapper that hides `getCurrentTime`.
- `@supabase/supabase-js` for auth and data.
- Vitest for unit tests.
- Plain CSS or CSS modules. The prototype's styling is a fine starting point.
- GitHub Pages deployment via GitHub Actions on push to `main`.

### 4.2 Configuration and security

- Env variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, injected at build time from GitHub Actions secrets. Provide `.env.example`; `.env` is git-ignored.
- The anon key is public by design; security comes from Row Level Security, mandatory on every table. The service-role key never appears in the repo or the frontend; the worker (§9) reads it from a local env file on the user's machine only.
- Vite `base` = `/<repo-name>/`. Hash routing so deep links work on GitHub Pages.
- Supabase Auth: allowed redirect URLs include the GitHub Pages URL and `http://localhost:5173`.

### 4.3 Auth

Email magic link sign-in (optionally GitHub OAuth). The whole app sits behind sign-in. Every row carries `user_id`; RLS restricts access to `auth.uid() = user_id`.

### 4.4 YouTube player capabilities

- Videos must be public or unlisted and allow embedding. Private videos do not play in an embed. Say so on the add-video screen and when a player error occurs.
- Accept any YouTube URL form: `watch?v=`, `youtu.be/`, `live/`, `shorts/`, with or without `t=` or extra parameters. Reject anything else with a clear message.
- Available: play/pause, `seekTo`, `getCurrentTime`, `getDuration`, playback rates 0.25×–2×, state events.
- Not available: frame-accurate stepping, frame rate, pixel access. "Frame step" seeks by `1/fps` where `fps` is 30 or 60, chosen per video (default 30). The help text says stepping is approximate.
- Poll `getCurrentTime()` at animation-frame rate while playing to drive the timer, playhead and log highlight.
- Focus: an iframe with focus swallows key events. Wrap the player in a container that recaptures focus on click and after every player interaction; show a small hint ("click outside the video to use shortcuts") when a key press arrives while the iframe has focus and nothing happens.
- Calibration clicks: a transparent overlay over the iframe intercepts clicks while paused; the iframe still shows the frame underneath. Points are stored in normalized coordinates of the *video frame*, not the player element: compute the letterboxed video rectangle inside the player from the video's aspect ratio (via YouTube oEmbed `width`/`height`, default 16:9) and convert. Unit-test this conversion.

## 5. Data model

Use `text` columns with `CHECK` constraints, not Postgres enums. Schema in `supabase/migrations/0001_init.sql`. All times are seconds from the start of the YouTube video.

```sql
create table videos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  youtube_id   text not null,
  title        text,
  duration_s   numeric,
  fps          integer not null default 30 check (fps in (30, 60)),
  recorded_on  date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, youtube_id)
);

create table games (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  video_id     uuid not null references videos on delete cascade,
  start_s      numeric not null,
  end_s        numeric,
  my_side      text not null check (my_side in ('left','right')),
  format       text not null default 'singles' check (format in ('singles','doubles')),
  opponent     text,
  my_score     integer,
  opp_score    integer,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_s is null or end_s > start_s)
);

-- Four playfield corners in normalized video coordinates (0..1), clockwise starting
-- at the corner nearest the user's goal on the left of the frame.
create table calibrations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  video_id   uuid not null references videos on delete cascade,
  game_id    uuid references games on delete cascade,   -- null = whole video; set if the camera moved
  points     jsonb not null,                              -- [{x,y},{x,y},{x,y},{x,y}]
  frame_s    numeric,                                     -- video time of the frame used
  created_at timestamptz not null default now()
);

create table possessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  game_id       uuid not null references games on delete cascade,
  start_s       numeric,
  shot_s        numeric,
  setup         text not null default 'Middle' check (setup in ('Middle','Pull side','Push side')),
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
  check (start_s is null or shot_s is null or shot_s >= start_s)
);
create index on possessions (game_id, start_s);

-- Requests for the offline worker (§9). Created by the app, consumed by the worker.
create table analysis_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  video_id     uuid not null references videos on delete cascade,
  game_id      uuid references games on delete cascade,   -- null = all games on the video
  status       text not null default 'queued' check (status in ('queued','downloading','analyzing','done','failed')),
  progress     numeric check (progress between 0 and 1),
  message      text,
  candidates   integer,
  requested_at timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
```

Rules:

- Manual possessions: `source = 'manual'`, `review_status = 'confirmed'`. Automatic ones arrive `auto` / `unreviewed` and become `confirmed` or `rejected` in review. **Statistics use confirmed possessions only.**
- Possession length is derived (`shot_s - start_s`), never stored.
- `shot_type = 'No shot'` implies direction, hole, result and execution are null. Enforce in the UI; a check constraint is welcome.
- `updated_at` trigger on every table that has the column.
- RLS on every table: select/insert/update/delete `using (auth.uid() = user_id) with check (auth.uid() = user_id)`. Child rows also verify the parent belongs to the same user.
- Deleting a video cascades to games, calibrations, possessions and jobs; the UI confirms and states the counts.

## 6. Functional requirements

Each requirement has an id for reference in commits and tests.

### 6.1 Videos (VID)

- **VID-1** Add a video by pasting a URL. Resolve the YouTube id; fetch title and aspect ratio via oEmbed; create the row; open the video. If the id already exists for the user, open the existing row instead of erroring.
- **VID-2** List videos with title, recorded date, game count, confirmed possession count, and whether an analysis job is running. Sort newest first.
- **VID-3** Edit title, recorded date, fps, notes. Delete with confirmation showing what will be removed.
- **VID-4** If the embed reports an error (private, removed, embedding disabled), show the reason and what to change on YouTube.

### 6.2 Games (GAM)

- **GAM-1** On the video screen, mark game start with **B** and end with **E** at the current player time (buttons too). Starting a new game while one is open closes it at the current time first.
- **GAM-2** Each game has `my_side` (required; defaults to the previous game's value on the same video), `format`, `opponent`, scores, notes. Editable inline in the game list.
- **GAM-3** Clicking a game seeks to its start and opens the tagging screen scoped to that game.
- **GAM-4** Games may not overlap; the UI prevents it and explains why.

### 6.3 Tagging (TAG)

Layout as in the prototype: player with custom controls and a timeline strip on the left, tag panel on the right, statistics and editable possession log below. The timeline covers the game's time range only. On narrow screens, stack vertically; every action must be reachable by tap.

- **TAG-1 Keyboard.** Shortcuts are ignored while focus is in an input, select or textarea. Pressing a tag key a second time clears that field. Tag buttons do not take focus on click, so Space and Enter keep their meaning.

| Key | Action |
|---|---|
| S | Ball set: start possession at current time. If the draft already has a shot time, save it first, then start the new one. |
| F | Shot: set shot time (possession ends). |
| N | No shot: set end time, type = No shot, save immediately. |
| Enter | Save draft. Missing fields stay null. |
| Esc | Clear draft. |
| U | Delete the most recently saved possession (single-step undo). |
| Z / X / C | Setup: Pull side / Middle / Push side |
| 1 / 2 / 3 | Shot type: Pin / Pull / Other |
| Q / W / E | Direction: Pull / Push / Straight |
| A / M / D | Hole: Pull-side lane / Middle lane / Push-side lane |
| G / H | Result: Goal / No goal |
| J / K | Execution: Proper / Misexecuted |
| Space | Play / pause |
| ← / → | Seek 1 s; with Shift, 5 s |
| , / . | Step about one frame back / forward |
| [ / ] | Slower / faster through 0.25, 0.5, 0.75, 1, 1.5, 2 |

- **TAG-2** After each save, Setup resets to Middle.
- **TAG-3** A large live timer shows the open possession's length, frozen after F. A status line states the next step ("Press S when the ball is set", "Press F at the shot", "Still blank: hole, execution").
- **TAG-4** If F is pressed at a time before the draft's start, refuse with a message; do not silently swap.
- **TAG-5** Times outside the game's range are refused with a message suggesting to adjust the game boundaries.
- **TAG-6 Timeline strip.** One segment per possession, colored by outcome: goal, no goal, no shot, untagged, current draft, and a distinct style for unreviewed candidates. A playhead. Click to seek; click a segment to jump 1 s before it. Hovering shows the possession's tags.
- **TAG-7 Log.** Table of possessions in time order with every field editable inline; clicking the start time seeks 1 s before it; delete per row with a single confirmation; the row under the playhead is highlighted; unreviewed rows show Confirm and Reject.
- **TAG-8 Help.** A collapsible panel with the tag definitions (§2) and the key table.

### 6.4 Persistence and connectivity (SYN)

- **SYN-1** Every save writes to Supabase immediately with an optimistic update.
- **SYN-2** Failed writes go to a local pending queue (localStorage) keyed by row id, with a visible "unsynced changes: n" indicator. Retry with backoff and on the browser's `online` event. Tagging is never blocked by the network, and no tag is silently lost.
- **SYN-3** Log edits are debounced (about 500 ms) and written the same way.
- **SYN-4** On load, pending queue entries are replayed before data is fetched, then the fetched data wins for anything not pending.

### 6.5 Statistics (STA)

All statistics are pure functions in `src/stats/` taking a list of confirmed possessions; no UI or database imports.

- **STA-1** Percentages use only possessions where the relevant field is tagged. Blank is not failure.
- **STA-2** Every percentage displays its sample size, e.g. `58% (7/12)`.
- **STA-3** Any percentage resting on fewer than 30 attempts is visibly marked as a small sample.
- **STA-4** Scopes: one game; one video (all its games); a date range across videos. Filters: shot type, format, opponent.
- **STA-5** Headline numbers: possessions, shots, conversion, proper-execution rate, median possession length, share of no-shot possessions.
- **STA-6** By shot: rows grouped by shot type + direction + hole with attempts, goals, conversion, proper rate, average possession length; sorted by attempts.
- **STA-7** Execution vs. result: 2×2 table (Proper/Misexecuted × Goal/No goal) with conversion per row, plus this note: "Proper shots that don't score point to the goalie reading you (selection or disguise). Misexecuted shots that score are luck you can't rely on."
- **STA-8** Conversion by possession length: under 5 s, 5–10 s, 10–15 s, 15 s or more. Requires both times.
- **STA-9** By setup: Middle vs. off-middle.
- **STA-10** By hole lane: conversion per lane.
- **STA-11** Progress: per video over time, conversion and proper rate with sample sizes, as a line chart and a table, honoring the filters.

### 6.6 Export (EXP)

- **EXP-1** CSV for one game, one video, or a date range. Columns: `video_title, recorded_on, youtube_id, game_index, opponent, format, my_side, n, start_s, shot_s, length_s, setup, shot_type, direction, hole, result, execution, source`. Times with two decimals; empty string for null; RFC 4180 quoting.
- **EXP-2** Copy to clipboard (with a selectable fallback if the clipboard API is blocked) and file download.
- **EXP-3** Confirmed possessions only, unless the user ticks "include unreviewed candidates".

### 6.7 Calibration (CAL)

- **CAL-1** "Set playfield corners" pauses the video and lets the user click four corners on the overlay in the documented order (clockwise from the corner nearest the user's goal on the left of the frame), with drag to adjust and a redo button. The quadrilateral is drawn over the player.
- **CAL-2** Saved per video with `frame_s`; optionally per game if the camera moved.
- **CAL-3** The UI states that the app does not use the calibration yet; it exists for the automatic worker.

### 6.8 Analysis jobs (JOB) — later

- **JOB-1** Once a video has at least one game with `my_side` and a calibration, an "Analyze" button creates an `analysis_jobs` row.
- **JOB-2** The video screen shows job status, progress and message, via Supabase realtime or 5-second polling.
- **JOB-3** The web app never downloads or processes video itself.

## 7. Non-functional requirements

- Initial load under 2 s on a normal connection; the player loads lazily.
- Keyboard-only tagging must be possible for the entire flow.
- Accessible names on all controls; visible focus; color is never the only carrier of meaning (segments also differ by pattern or label).
- Works in current Chrome, Firefox and Safari. Dark and light themes following the system.
- No third-party analytics.

## 8. Testing strategy

- Unit tests (Vitest) for: statistics (STA-1 to STA-11) against fixture data with known answers; CSV generation and quoting; YouTube URL parsing; letterbox coordinate conversion (§4.4); pending-queue replay logic.
- Component tests for the tag panel keyboard state machine (draft transitions for S, F, N, Enter, Esc, U).
- Manual test script in `docs/manual-tests.md`, updated with each feature, covering: offline tagging then reconnect; private video error; game overlap prevention; frame stepping at 30 and 60 fps.
- Fixture: one real game tagged by hand (`fixtures/game-01.json`), reused later to validate the worker (§9.5).

## 9. Automation (target; not in the MVP)

### 9.1 Constraints

- A browser cannot read pixels from a YouTube embed (cross-origin). Detection must run on a video *file*, outside the app.
- Downloads from datacenter IPs are frequently blocked by YouTube's bot checks, and free CI runners have run-time limits a multi-hour stream exceeds. The worker therefore runs on the user's own always-on machine, ideally the one that streams.
- YouTube Studio's manual download is typically limited to 720p, which hurts detection of a small ball.

### 9.2 Worker

A Python program in `tracker/` (OpenCV, NumPy; a small detector model only if color/motion segmentation proves insufficient). It polls `analysis_jobs` with the service-role key (local env file only) and, per queued job: obtains the file, runs detection, writes candidates (`source = 'auto'`, `review_status = 'unreviewed'`, `confidence`), updates progress and status, deletes the file. It retries `downloading` jobs whose archive is not yet available rather than failing them.

Obtaining the file, in order of preference:

1. A local recording made by the streaming software at the same time as the stream (OBS records while streaming). Match recordings to videos by recording time. No download at all.
2. `yt-dlp` at full resolution from the home IP.

### 9.3 Calibration and geometry

Four playfield corners give a homography that rectifies the camera view into table coordinates. Every zone (goals, 2-bar, 5-bar, 3-bar per side) then follows from standard table dimensions with no extra input, and it works for angled cameras. Two points only suffice for a perfectly overhead, axis-aligned camera.

### 9.4 Detection pipeline

Homography → rectified frames → ball detection (color threshold plus background subtraction first) → tracking with gap tolerance (the ball is often hidden by rods and figures) → state machine per game using `my_side`: ball settles in the user's 3-bar zone → possession start; ball leaves the zone toward the goal → shot time; ball enters the goal region → Goal, otherwise No goal; ball leaves the zone elsewhere → No shot.

Automation can plausibly fill `start_s`, `shot_s`, `setup`, `direction`, `hole`, `result`. `shot_type` and `execution` stay manual. Candidates arrive partly filled; review completes them.

### 9.5 Camera reality and validation

The user's camera is in front of the table, not overhead. From that angle the near rods and the player's hands and body occlude the ball often, the far half of the table is compressed into few pixels, and figures hide the ball. Expect detection to be much better for the 3-bar nearest the camera than the far one, possibly unusable for the far one. The worker decides per game, from `my_side` and calibration geometry, whether to attempt detection, and reports confidence rather than emitting low-quality candidates.

Before any further investment: run the worker on the hand-tagged fixture game and report recall and precision per event type (possession found, shot time within 0.5 s, result correct). If recall on the near-side 3-bar is below about 80%, improve the camera position before improving the code.

## 10. Build order

1. Scaffold Vite + React + TS, Supabase client, env config, magic-link auth, GitHub Pages deploy workflow. A signed-in empty app deploys.
2. Migration with tables and RLS. Videos screen (VID-1..4).
3. Video screen: player, custom controls, keyboard capture, games (GAM-1..4).
4. Tagging screen (TAG-1..8) with persistence (SYN-1..4).
5. Statistics (STA-1..10) with unit tests; game, video and date-range scopes.
6. Export (EXP-1..3).
7. Calibration (CAL-1..3).
8. Progress view (STA-11).
9. Analyze button and job status (JOB-1..3); worker (`tracker/`) starting with the validation run (§9.5).

The app stays deployable after every step, and each step ends with a short list of things for the user to test by hand.

## 11. Open questions

- Which foosball table model and dimensions are used (needed for zone geometry in §9.3)?
- Does the streaming setup record locally, and where do recordings land?
- Should possessions record the score state at the time of the shot (for pressure analysis)? Not in the MVP; revisit after a few weeks of data.
- Per-shot execution criteria: the player writes down what "misexecuted" means per shot and the tag panel shows it while tagging. Deferred.
