# Architecture Decision Records

Decisions that refine or override `PRD.md`. Where this file and the PRD differ, this file wins.
Add a new record for every decision; never rewrite an accepted one. Supersede it with a new
record and mark the old one `Superseded by ADR-00xx`.

Format: context → decision → consequences. Keep each record short.

---

## ADR-0001 · Record decisions in ADR.md

- **Status:** Accepted · 2026-09-23
- **Context:** The PRD is the requirements baseline; decisions made while building need a durable home.
- **Decision:** Every architectural or product decision that refines or deviates from the PRD gets a numbered record here, referenced from commits.
- **Consequences:** `CLAUDE.md` points here. The PRD stays as written; this file is read alongside it.

## ADR-0002 · `possessions.setup` is nullable

- **Status:** Accepted · 2026-09-23
- **Context:** PRD §5 declares `setup not null default 'Middle'`, but TAG-1 (pressing a key again clears the field), STA-1 (blank is never a failure) and worker candidates (setup may be unknown) all require a blank setup. With `not null`, untagged setups would be counted as Middle in STA-9.
- **Decision:** `setup text check (setup in ('Middle','Pull side','Push side'))`, nullable, no default. New drafts start at Middle in the UI (TAG-2); pressing the active setup key again clears it to null.
- **Consequences:** STA-9 excludes null setups from its denominators. Migration `0001_init.sql` differs from PRD §5 on this column.

## ADR-0003 · Linting with oxlint

- **Status:** Accepted · 2026-09-23
- **Context:** Fast lint with TypeScript and React hook rules; typescript-eslint does not support TypeScript ≥ 6.1.
- **Decision:** `oxlint` (config in `.oxlintrc.json`) with the `typescript`, `react`, `import` and `vitest` plugins; `npm run lint` runs it with `--deny-warnings`. Type checking is `tsc`. No ESLint.
- **Consequences:** Rules that need type information are not linted; `tsc` strict mode covers most of them.

## ADR-0004 · Magic-link auth uses the PKCE flow

- **Status:** Accepted · 2026-09-23
- **Context:** Supabase's implicit flow returns tokens in the URL hash, which collides with hash routing on GitHub Pages.
- **Decision:** `flowType: 'pkce'`. The link returns `?code=` in the query string; the app exchanges it and removes it from the address bar. Redirect target is the app root (`origin + pathname`).
- **Consequences:** A magic link must be opened in the same browser that requested it (the code verifier lives in that browser's storage). The sign-in screen says so. An email OTP code fallback would need a separate decision.

## ADR-0005 · Hosting on GitHub Pages under `dejvicek/foosball-tagger`

- **Status:** Accepted · 2026-09-23
- **Context:** Pages needs a public repo on the free plan; the Vite `base` depends on the repo name.
- **Decision:** Public repo `github.com/dejvicek/foosball-tagger`, served at `https://dejvicek.github.io/foosball-tagger/`, Vite `base: '/foosball-tagger/'`, hash routing (no `404.html` needed). Deployed by GitHub Actions on push to `main` after lint, typecheck and tests pass. Commits use the account's noreply email.
- **Consequences:** Renaming the repo requires changing `base` and the Supabase redirect URLs.

## ADR-0006 · Toolchain versions

- **Status:** Accepted · 2026-09-23
- **Decision:** Exact pins: Vite 8, React 19.3, react-router 8 (`HashRouter`), supabase-js 2, Vitest 5, TypeScript 6.0 (not 7: keep compatibility with the wider TS tooling ecosystem). Node ≥ 22.22 (react-router requirement); CI uses Node 22.

## ADR-0007 · Keyboard focus with the YouTube embed

- **Status:** Accepted · 2026-09-23 (implemented in build step 3)
- **Context:** PRD §4.4 asks for a hint "when a key press arrives while the iframe has focus", but a focused cross-origin iframe delivers no key events to the page, so that cannot be detected.
- **Decision:** Player with `controls=0`, `disablekb=1`, iframe `tabindex=-1`. On window `blur` with `document.activeElement` being the iframe, return focus to the player container on the next tick; the hint is shown whenever the iframe holds focus. No permanent overlay over the player (YouTube policy); the transparent overlay exists only during calibration (CAL-1).

## ADR-0008 · Player time between `getCurrentTime()` updates

- **Status:** Superseded by ADR-0015
- **Context:** The IFrame API reports time asynchronously from the iframe, so values polled at animation-frame rate arrive in steps.
- **Decision:** While playing, interpolate from the last reported time using `performance.now()` × playback rate, resynchronised on every new report and on state changes. Tag times use the interpolated value. `seekTo` before the first play starts playback; the player cues and pauses explicitly where needed.

## ADR-0009 · Child-row RLS checks the parent's owner

- **Status:** Accepted · 2026-09-23 (implemented in build step 2)
- **Context:** Foreign-key checks bypass RLS, so `auth.uid() = user_id` alone lets a user attach rows to another user's parent id.
- **Decision:** Insert/update policies on `games`, `calibrations`, `possessions`, `analysis_jobs` also require `exists (select 1 from <parent> p where p.id = <fk> and p.user_id = (select auth.uid()))`. Policies are written per command (`insert` has only `with check`; `select`/`delete` only `using`).

## ADR-0010 · Tagging and sync semantics

- **Status:** Accepted · 2026-09-23 (implemented in build steps 3–4) · key names superseded by ADR-0021
- **Decision:**
  - B and E (game start/end) work only on the video screen; on the tagging screen E means Straight. Game boundaries are adjusted on the video screen.
  - A game with `end_s` null uses the video duration as its range.
  - For a No-shot possession, `shot_s` holds the end time.
  - S with a start but no shot moves the start to the current time (prototype behavior).
  - U deletes the last possession saved in the current page session.
  - Row ids are generated in the browser (`crypto.randomUUID()`); writes are upserts. The pending queue replays in dependency order (parents first); deleting a row whose insert is still pending cancels both.

## ADR-0011 · Prototype file name

- **Status:** Accepted · 2026-09-23
- **Decision:** The prototype is `reference/foosball-tagger-v1.html`, matching `PRD.md` and `CLAUDE.md`.

## ADR-0012 · GitHub OAuth sign-in alongside the magic link

- **Status:** Accepted · 2026-09-24
- **Context:** Supabase's built-in email service sends 2 emails per hour per project, which makes magic-link sign-in painful during development and on new devices. PRD §4.3 lists GitHub OAuth as optional.
- **Decision:** The sign-in screen offers "Sign in with GitHub" (primary) and the email magic link. GitHub sign-in uses the same PKCE redirect to the app root (ADR-0004), so it works on the deployed app and on localhost. The OAuth App lives under the `dejvicek` GitHub account.
- **Consequences:** Needs a GitHub OAuth App with callback `https://<project-ref>.supabase.co/auth/v1/callback`, and the GitHub provider enabled in Supabase. Signing in with GitHub and with email using the same address yields one Supabase user (automatic identity linking by verified email), so `user_id` stays the same.

## ADR-0013 · Schema additions: aspect ratio, video summary view, migration testing

- **Status:** Accepted · 2026-09-24
- **Context:** VID-1 fetches the aspect ratio, but PRD §5 has no column for it; VID-2 and VID-3 need per-video counts; RLS mistakes are silent, so they must be tested.
- **Decision:**
  - `videos.aspect_ratio numeric` (width / height), filled from oEmbed on creation.
  - `video_summaries` view (`security_invoker = true`, so RLS applies) with game, confirmed/total possession, calibration and job counts and `job_running`.
  - Extra checks beyond PRD §5: YouTube id format, non-negative times and scores, calibration `points` is a 4-element array.
  - Explicit grants: `authenticated` gets table access, `anon` gets none.
  - Migrations are tested in Vitest against PGlite (Postgres in WebAssembly) with a small stub of Supabase's `auth` schema (`supabase/tests/`). The Supabase CLI is a dev dependency, so `npx supabase db push` works without a global install.
- **Consequences:** `video_summaries` lists video columns as of its creation; a migration that adds a video column must recreate the view. The auth stub mimics `auth.uid()` only; anything else from Supabase's `auth` schema needs adding to the stub.

## ADR-0014 · Videos screens (build step 2)

- **Status:** Accepted · 2026-09-24
- **Decision:**
  - **Online-only video writes.** Adding, editing and deleting videos needs the network (adding needs oEmbed anyway); failures are shown with a retry. Only tagging writes (possessions, and games in step 3) go through the pending queue (SYN-2).
  - **Accepted links:** youtube.com / m. / music. / youtube-nocookie.com with `watch?v=`, `live/`, `shorts/`, `embed/`, `v/`, and `youtu.be/`, with any extra parameters. A bare 11-character id is rejected (PRD §4.4: "reject anything else").
  - **oEmbed refusal blocks adding.** If oEmbed says the video is private, not embeddable (401/403) or missing (400/404), the video is not added and the message says what to change on YouTube. Fix it on YouTube, then add again.
  - **Aspect ratio:** oEmbed returns rounded player sizes (200×113); ratios within 2% of 16:9, 4:3, 9:16, 1:1, 21:9 or 3:4 snap to it.
  - **Newest first** (VID-2) = by `recorded_on`, falling back to the date added, then by time added.
  - **Player errors** (VID-4): YouTube reports error 150 also for private or removed videos, so its message covers all three causes.
  - **Minimal player in step 2:** YouTube's own controls, used to show embed errors and record `duration_s`. Step 3 replaces it per ADR-0007.
  - Screens live in `src/videos/`.

## ADR-0015 · Player time and seeking, as measured

- **Status:** Accepted · 2026-09-24 · Supersedes ADR-0008
- **Context:** Measured in Chromium with the IFrame API (controls off): while playing, `getCurrentTime()` changes every ~33 ms, i.e. every video frame, not in coarse steps. Right after `seekTo` it still returns the old time for a moment. Seeking a video that has never played is unreliable. Available speeds include 1.25 and 1.75.
- **Decision:**
  - Read `getCurrentTime()` directly every animation frame; no interpolation.
  - After a seek, report the target until the player reports a *new* time near it, or for at most 1 s. The old time never counts as "arrived", so repeated frame steps add up.
  - Seeking before the first play starts playback and pauses again as soon as it plays.
  - Speeds are the PRD's 0.25, 0.5, 0.75, 1, 1.5, 2 (those the video supports); `[`/`]` step through them, and a speed set elsewhere moves to the next listed one.
  - `PlayerController` (`src/player/controller.ts`) holds this logic over a minimal player interface and is unit-tested with a fake player.
- **Consequences:** Firefox and Safari were not measured; the manual tests cover them.

## ADR-0016 · Pending write queue, used from step 3

- **Status:** Accepted · 2026-09-24
- **Context:** Games are written from step 3 on and must survive network drops like possessions (SYN-1..4). Building the queue once, now, avoids a second write path.
- **Decision:**
  - `WriteQueue` (`src/data/queue.ts`): every write is stored in localStorage (`fbtag:queue:v1:<user id>`) before it is sent; the UI updates optimistically.
  - One entry per row: repeated edits coalesce into the latest full row (an upsert on `id`, ids generated in the browser); a delete replaces a pending upsert, and a new row deleted before any send attempt is dropped.
  - Sending order: upserts parents first (games, then possessions), then deletes children first. Deleting a game drops its queued possession writes.
  - Retry on network or server errors with backoff 1 s, 2 s, 4 s… up to 60 s, and on the `online` event. Postgres data, constraint and permission errors (22xxx, 23xxx, 42xxx) are not retried: they are kept, shown in the header as "n changes refused" with the server's message, and dropped only when the user discards them.
  - On page load the queue flushes before data is fetched, and pending entries are laid over the fetched rows (SYN-4).
  - Header shows "Unsynced changes: n" (SYN-2). Inline edits flush after 500 ms (SYN-3).
- **Consequences:** Two devices editing the same row offline: the last write wins. Video rows stay online-only (ADR-0014).

## ADR-0017 · Marking games on the video screen

- **Status:** Accepted · 2026-09-24
- **Decision:**
  - **First game's side:** `my_side` is required and there is no previous game to copy, so before the first game the panel asks "Which side of the frame is your goal on?"; B is refused until it is answered. Later games take the side (and the format) of the game before them (GAM-2).
  - **Open game range:** a game without `end_s` runs until the next game starts, or to the end of the video (refines ADR-0010). At most one game is open.
  - **Overlap rules (GAM-4):** half-open ranges, so a game may start exactly where the previous one ended. B inside a closed game, E before the open game's start, or any boundary change that would overlap is refused with a message naming the games and times.
  - **Boundary edits:** each game has "Start here" / "End here" (current player time), checked by the same rules. No typed time fields.
  - **Deleting a game** (not named in the PRD, needed to undo a stray B): with a confirmation stating its possession count.
  - **GAM-3:** clicking a game's start time seeks there; "Tag →" opens the tagging screen, which seeks to the game start (a placeholder until step 4).
  - Messages appear as a short toast, announced to screen readers.

## ADR-0018 · Seek bar over the whole video

- **Status:** Accepted · 2026-09-24 (requested by the user; not in the PRD) · drag behaviour superseded by ADR-0022
- **Context:** Practice videos can be three hours long; ±5 s steps are too slow to get to a game.
- **Decision:**
  - A seek bar under the player on the video screen covers the whole video. Click or drag to seek; the time under the pointer is shown. While dragging, seeks use `allowSeekAhead = false` (at most one per 120 ms); releasing does a full seek.
  - Games are drawn on the bar as marks, so they can be found in a long video.
  - It is a custom `role="slider"`, not `<input type="range">`: clicking never takes focus (a focused range input would swallow the arrow keys and Space). With Tab focus, the arrows behave as everywhere else, Page Up/Down jump ±1 min, Home/End go to the ends.
- **Consequences:** On a 3-hour video one pixel of a 1000 px bar is about 11 s; fine positioning stays with the arrow keys and frame steps. The tagging screen's timeline (TAG-6) still covers only its game.

## ADR-0019 · Tagging screen (build step 4)

- **Status:** Accepted · 2026-09-24 · key names superseded by ADR-0021
- **Decision:**
  - **S before F** moves the start to the current time and keeps tags already set (the prototype discarded them; keeping them loses nothing).
  - **Enter** saves any draft with a time or a tag; a draft holding only the default Setup counts as empty.
  - **N** saves at once with direction, hole, result and execution blank (the database also enforces it).
  - **U** deletes the last possession saved on this page, and the one before it on the next press; after a reload there is nothing to undo.
  - **TAG-5:** S, F, N and "set to current time" in the log are refused outside the game's range (0.05 s tolerance at the edges); the message points to the video screen to adjust the game.
  - **Unsaved draft** is kept in localStorage per game (`fbtag:draft:v1:<game id>`) so a reload or closed tab doesn't lose it; it never reaches the server until saved.
  - **Log editing (TAG-7):** tag fields are selects; times are changed with "set to the current time" (⌖) next to each, checked like the keys. Delete asks once ("Delete?" on the same button, 3 s). Setting shot type to No shot clears the shot fields.
  - **Review:** unreviewed candidates show Confirm / Reject; rejected rows stay in the log, dimmed and unnumbered, with Confirm to restore them; they are left off the timeline.
  - **Timeline (TAG-6):** each outcome has its own pattern as well as colour: goal solid, no goal hatched, no shot dotted and thinner, untagged striped, candidate dashed outline, draft outlined. Clicking an empty spot seeks there; a segment seeks to 1 s before it. Covers only the game (an open game without a known video length shows 10 minutes).
  - **Statistics** below the timeline come in build step 5; the card shows the count and the help (TAG-8) meanwhile.
  - Refused S/F/N presses are also logged to the console with the player time, to diagnose unexpected refusals.

## ADR-0020 · Statistics definitions (build step 5)

- **Status:** Accepted · 2026-09-24
- **Context:** STA-1..10 name the numbers but not every edge case; the choices below decide what the percentages mean.
- **Decision:**
  - **Input:** confirmed possessions only (PRD §5), including writes still in the pending queue.
  - **Shot or not:** "No shot" → not a shot; any shot type → shot; no type but a shot time (F was pressed) → a shot of unknown type; no type and no shot time → outcome unknown, left out of the no-shot share and of all shot statistics.
  - **Denominators (STA-1):** conversion = goals / shots with a result; proper rate = Proper / shots with an execution; no-shot share = no-shot / possessions with a known outcome. Median length over all possessions with both times; average length per shot row over its shots with both times.
  - **By shot (STA-6):** groups by the exact (type, direction, hole), blanks shown as "–"; most attempts first, ties in schema order (Pin, Pull, Other; Pull, Push, Straight; pull-side, middle, push-side lane), blanks last.
  - **Execution vs. result (STA-7):** shots with both tagged. **Length buckets (STA-8):** shots with both times; each bucket includes its lower bound (5.0 s is in 5–10 s). **Setup (STA-9):** Middle, Off-middle, and Off-middle split into Pull side / Push side; shots with a setup. **Hole (STA-10):** shots with a hole.
  - **Display (STA-2, STA-3):** every percentage is "58% (7/12)", rounded to whole percent; a † marks fewer than 30 attempts, with a footnote. An empty denominator shows "– (0/0)".
  - **Scopes (STA-4):** game, video, or date range. A video's date is its recorded date, else the day it was added. Filters: shot types (any of), format, opponent ("no opponent" selectable). Scope and filters live in the URL (`#/stats?…`). The tagging screen shows live statistics for its game.
  - **Fixture:** tests use `fixtures/synthetic-01.json`, a made-up game whose expected numbers were worked out by hand. The PRD's real hand-tagged `fixtures/game-01.json` is added once export exists (step 6), with its own expected numbers checked by hand against the CSV.
  - Pure functions live in `src/stats/`; their UI in `src/statsView/`.

## ADR-0021 · Keyboard layout: left-hand grid, optional right-hand player keys

- **Status:** Accepted · 2026-09-24 (chosen by the user) · Replaces the key table of PRD TAG-1 and the key names in ADR-0010 / ADR-0019
- **Context:** The PRD keys were mnemonic but spread over both hands (M, H, J, K, N, U, Enter on the right), so tagging with the mouse in the right hand was impossible, and the pull/push options sat in different orders per field.
- **Decision:** All tagging on the left hand; each row one field; the first three columns always run pull → middle → push (fixed, not mirrored per game).

  | | col 1 | col 2 | col 3 | index | stretch |
  |---|---|---|---|---|---|
  | number row | 1 Setup pull side | 2 Setup middle | 3 Setup push side | 4 Save | 5 Proper |
  | top row | Q Direction pull | W Direction straight | E Direction push | R Ball set | T Misexecuted |
  | home row | A Hole pull-side | S Hole middle | D Hole push-side | F Shot | G Goal |
  | bottom row | Z Pin | X Pull | C Other | V No shot | B No goal |

  - Esc clears the draft; ⌘Z / Ctrl+Z undoes the last save (inside a field it stays the field's own undo); Space plays/pauses.
  - Right hand (optional): J / K / L back 1 s, play/pause, forward 1 s (Shift = 5 s); U / O frame back/forward; Enter saves; Backspace undoes. Arrows, `,` `.` `[` `]` keep working. The J/K/L/U/O keys also work on the video screen.
  - Unchanged rules: a second press clears a field; ball set after a shot saves and starts the next; B / E stay the game keys on the video screen only.
  - The tag panel lists fields in keyboard-row order; the help shows the grid as a keyboard map. Key names in messages and buttons come from one table (`src/tagging/keyLabels.ts`).
- **Consequences:** Muscle memory from the PRD keys (S, N, U, J/K for execution, H for no goal) no longer applies.

## ADR-0022 · Drag to seek; keys by physical position

- **Status:** Accepted · 2026-09-24 (requested by the user) · Supersedes the drag details of ADR-0018
- **Context:** Dragging the seek bar did not show it could be dragged and the picture only moved on release; the tagging timeline only took clicks. On Czech and Slovak (QWERTZ) keyboards Y and Z are swapped, and the Czech number row types `+ ě š č ř`, so 1–5 did nothing.
- **Decision:**
  - **Dragging:** one `useScrubber` hook for the seek bar and the tagging timeline. The handle follows the pointer every frame; the video seeks (full seek, frames load) at most every 250 ms while dragging and once on release. The pointer is captured, so dragging over the video or past the ends works; the time is clamped to the bar (the timeline to its game). The seek bar seeks on press; the timeline starts a drag only after 4 px of movement, so a click on a possession still jumps 1 s before it, and the click that ends a drag is swallowed. Both show a round handle and the time under the pointer. The "scrub without seek-ahead" mode of ADR-0018 is removed.
  - **Keys by position:** every single-key shortcut matches `KeyboardEvent.code` (the physical key), not the character: the grid of ADR-0021 stays in the same place on QWERTZ, AZERTY or Dvorak, and the number row works whatever it types. Space, Enter, Esc, Backspace and the arrows match by name. Chords follow the character like the operating system does: ⌘Z / Ctrl+Z is the key labelled Z.
  - **Labels follow the keyboard:** buttons, messages and the keyboard map show the character printed on the user's key. Source, most trusted first: the character the user actually typed on that key (learned from every key press, ignoring Alt/Ctrl/⌘ combinations), the Keyboard Map API (`navigator.keyboard.getLayoutMap`, Chromium only), a guess from the browser language (QWERTZ for cs, sk, de, hu, sl, hr…, AZERTY for fr), then US. The number row always shows digits (printed on every layout). Labels update live.
- **Consequences:** In Firefox or Safari with an unusual layout and a language that doesn't hint at it, labels are US until the user presses the key once; the keys themselves work from the start.

## ADR-0023 · Cinema mode; side of the frame; doubles players

- **Status:** Accepted · 2026-10-01 (requested by the user; side and players chosen by the user) · Amends PRD §2 (`my_side`), GAM-2, STA-4, EXP-1, CAL-1
- **Context:** The video was small next to the side panel. The game form asked "My goal: Left/Right", but in the user's recordings the goals are at the top and bottom of the frame and the players stand at the left and right. Doubles had only one opponent field.
- **Decision:**
  - **Cinema mode:** a Cinema / Default view button at the end of the player controls on the video and tagging screens. In cinema mode the player column (video, seek bar or timeline, controls) spans the viewport width less 16 px each side, capped so the video plus controls fit the window height, and the games panel or tag panel moves below it. No shortcut (T is Misexecuted, ADR-0021). The choice is per viewer, kept in localStorage, shared by both screens.
  - **`my_side`** now means the side of the frame the user stands on: left or right. Same column and values, no migration; the user's goal end (top/bottom) follows from it and the camera position and is not entered. UI: "My side"; before the first game: "Which side of the frame do you stand on?". Existing games keep their stored value, which the user re-checks.
  - **Players:** `format` stays, shown as a Singles / Doubles switch. Singles: Opponent. Doubles: Teammate, Opponent 1, Opponent 2. New nullable columns `games.teammate` and `games.opponent2` (migration `0002_game_players.sql`), with a CHECK that both are null unless the format is doubles; switching to singles clears them. `opponent` remains the first opponent.
  - **Statistics:** the Opponent filter matches either opponent of a doubles game and lists every name once; "(no opponent)" selects games with neither. Game labels read "vs A" or "with T · vs A & B".
  - **Later steps:** EXP-1 adds `teammate` and `opponent2` after `opponent`. CAL-1's corner order and the worker's use of `my_side` are restated in terms of the side the user stands on when step 6 is built.
- **Consequences:** The deployed frontend writes the new columns, so the migration must be applied before the frontend that uses it is deployed.

## ADR-0024 · Repeat a seek the player drops before the first play

- **Status:** Accepted · 2026-10-01 (bug reported by the user) · Amends ADR-0015
- **Context:** The tagging screen of a game on a video uploaded the same day opened at 0:00 instead of the game start (GAM-3). Measured in the browser: before the first play the player reported the old length (10106 s) and took the seek (223.6 s); once playback started it reloaded with a different length (9910 s), began at 0 and the start-then-pause of ADR-0015 paused it there. Seeks after the first play work. A video whose length does not change keeps the seek.
- **Decision:** A seek made before the first play is remembered until the player is seen near it (0.5 s). When the player reports playing elsewhere, the controller seeks again while still playing and pauses only once it is there; it gives up after 3 extra seeks and pauses where the player is. Until then the current time reported to the app is the seek target, without the 1 s settle timeout. A seek made after the first play replaces the remembered one. The video length is read again on each state change, so the readout shows the length after the reload.
- **Consequences:** Such a video can play a fraction of a second from 0:00 before landing at the game start. Opening at a game start lands about 0.2 s after it (the pause follows the playing event).

## ADR-0024 · Cinema mode keeps the side panel

- **Status:** Accepted · 2026-10-01 (requested by the user) · Supersedes the cinema-mode layout of ADR-0023
- **Context:** With the panel moved below the video, the games form or the tag panel was off screen while watching, which defeats the point of a working view.
- **Decision:** Cinema mode keeps the two columns. The player grid (video column plus games panel or tag panel) spans the viewport width less 16 px each side instead of the 1440 px page width, and the video may grow to the window height less 190 px for the controls (default view: 70 % of the window height). Below 960 px the columns stack as in the default view. The rest of ADR-0023's cinema mode (button, no shortcut, remembered per viewer) is unchanged.
- **Consequences:** The gain is largest on wide windows; on a window close to 1440 px wide the video grows mainly in height.

## ADR-0025 · Cinema mode is a focus view

- **Status:** Accepted · 2026-10-01 (requested by the user; same-page variant chosen by Claude) · Supersedes the cinema-mode layout of ADR-0023 and ADR-0024
- **Context:** The point of cinema mode is maximum focus on tagging (or marking games). A bigger video alone still left the header, titles, forms and tables around it. The user offered a separate page or hiding unrelated elements on the same page.
- **Decision:** Same page, unrelated elements hidden: the routes, keys, state and Cinema / Default view button stay as they are. While a player screen is in cinema mode it sets `data-cinema` on `<html>`, and CSS hides the app header (except the sync status, fixed in the top-right corner so pending or refused writes stay visible), breadcrumbs, title and meta, the frame-step hint, the video details and delete card on the video screen, and the game numbers and possession log on the tagging screen. The player grid spans the viewport less 16 px each side with the games panel or tag panel beside it, and the video grows to the window height less the controls under it (120 px on the video screen, 150 px on the tagging screen). Below 960 px the panel stacks under the player.
- **Consequences:** The possession log is not visible in cinema mode; editing earlier possessions means switching to the default view. The choice remains per viewer and shared by both screens.

## ADR-0026 · Five holes, direction derived, tag panel in tagging order

- **Status:** Accepted · 2026-10-02 (requested by the user; keys, direction rule and handling of old data chosen by the user) · Supersedes the key grid of ADR-0021 and the Direction and Hole definitions of PRD §2; amends TAG-1, STA-6, STA-10, EXP-1 and §9
- **Context:** Three lanes were too coarse: the user wants to see whether a pull-side shot went long or short. Direction was a separate tag, but it follows from setup and hole, so tagging it cost a key press for no new information. The panel listed the fields in keyboard-row order rather than the order the user thinks about a shot.
- **Decision:**
  - **Hole:** five values, pull → push: `Pull long`, `Pull short`, `Middle`, `Push short`, `Push long` (fixed positions seen from the shooter, as before). Migration `0003_holes.sql` replaces the CHECK; existing `Middle lane` becomes `Middle`, existing `Pull-side lane` / `Push-side lane` are cleared (they cannot be split) for the user to re-tag.
  - **Direction:** no longer stored (`possessions.direction` dropped). `directionOf(setup, hole)` in `src/stats/direction.ts` derives it: a setup covers its whole lane, so the hole's lane (pull, middle, push) equal to the setup's is Straight, further toward pull is Pull, toward push is Push. From a pull-side setup, Pull long and Pull short are both Straight. Blank when setup or hole is blank. STA-6 groups by shot type + derived direction + hole; EXP-1 will write the derived value in its `direction` column.
  - **Tag panel order:** Ball set / Shot / No shot, then Shot type, Setup, Hole, Execution, Result. The possession log and the "Still blank" status use the same order.
  - **Keys** (physical positions, ADR-0022):

    | | | | | | |
    |---|---|---|---|---|---|
    | number row | 1 Pull long | 2 Pull short | 3 Middle | 4 Push short | 5 Push long |
    | top row | Q Pin | W Pull | E Other | R Ball set | |
    | home row | A Setup pull side | S Setup middle | D Setup push side | F Shot | G Goal |
    | bottom row | Z Proper | X Misexecuted | | V No shot | B No goal |

    Enter saves (4 no longer does), Backspace and Esc clear the draft, ⌘Z / Ctrl+Z undoes the last save (Backspace no longer does). T and C are free.
  - A draft kept in localStorage from before this change loses its direction and any old hole value when loaded.
- **Consequences:** Muscle memory from ADR-0021 no longer applies. Saving needs Enter (right hand) or R for the next possession. The migration must be applied before the frontend that uses it is deployed, and writes still pending from the old frontend that carry `direction` would be refused, so sync before deploying.

## ADR-0027 · Shot type starts at Pin

- **Status:** Accepted · 2026-10-02 (requested by the user) · Amends TAG-2
- **Context:** Most possessions end in a pin shot, so pressing Q every time was wasted effort.
- **Decision:** A new draft has Shot type Pin, like Setup starts at Middle; it resets to Pin after every save and clear. Q on a draft showing Pin clears the field, W / E switch it, V saves No shot as before. Pin and Middle together do not count as content: Enter on an untouched draft still says there is nothing to save.
- **Consequences:** A possession saved without F (R, then Enter) is saved as a Pin and counts as a shot in the statistics, where before it was left out as unknown (ADR-0020). Clear the shot type with Q, or press V, for possessions that ended without a shot.

## ADR-0028 · Shot direction (Straight, Z/7); derived direction renamed Movement

- **Status:** Accepted · 2026-10-02 (requested by the user; key, old rows, statistics and naming chosen by the user) · Amends ADR-0026, TAG-1, STA-6, EXP-1
- **Context:** The user wants to tell straight shots from Z/7 shots. The value derived from setup + hole (ADR-0026) was also called "direction", which would clash.
- **Decision:**
  - **Field:** new column `possessions.shot_direction` with values `Straight`, `Z/7` (migration `0004_shot_direction.sql`). Existing possessions get `Straight`, except No shot rows, which stay blank: the No-shot check now also requires a blank shot direction.
  - **Tagging:** a new draft starts at Straight, like Setup at Middle and Shot type at Pin; the defaults alone are not content. **C** flips Straight ⇄ Z/7 (from blank: Z/7), so the key never blanks it; clicking the selected button blanks it, as for every field, and so does the log. V (No shot) blanks it. The panel order is Shot type, Setup, Hole, Shot direction, Execution, Result; the log and the "Still blank" status follow it.
  - **Movement:** the derived Pull / Straight / Push of ADR-0026 is called Movement (`movementOf`, `src/stats/movement.ts`). The tag panel shows it read-only under Hole; By shot groups by shot type · movement · hole. EXP-1 will name its column `movement` and add `shot_direction`.
  - **Statistics:** a "By shot direction" table after "By hole": attempts, conversion and proper rate for Straight and Z/7, over shots with a shot direction.
- **Consequences:** Old shots read Straight even where they were Z/7; re-tag those in the log. Apply migration 0004 together with 0003 before deploying the frontend.

## ADR-0029 · Timeline colors; fouls over 15 s; player column as wide as the video

- **Status:** Accepted · 2026-10-02 (requested by the user; colors and foul display chosen by Claude) · Amends TAG-3, TAG-6, TAG-7
- **Context:** On the timeline, goals were white and no goals red on a green (felt) strip, so green could not mean Goal. The rules allow at most 15 s per possession on the 3-bar; longer is a foul, which the user wants to see (and be discouraged by) without changing how it is tagged. On a wide monitor the video was capped at 70 % of the window height and centered, while the timeline and controls under it spanned the whole column, so they were wider than the video.
- **Decision:**
  - **Colors:** the strip is a neutral dark grey (`--strip`); Goal is solid green (`--goal`), No goal stays red stripes, No shot grey dots, Untagged white stripes, the current possession wood, candidates a yellow dashed outline, the playhead yellow. Colors are CSS tokens with dark-mode values.
  - **Foul:** a possession whose length (shot − start) is over 15 s (`FOUL_LIMIT_S`, `isFoul` in `src/tagging/possessions.ts`; exactly 15 s is legal) is a foul, whatever its tags, including No shot. It is derived, never stored, and the tags are saved as entered. It shows as orange-and-black warning stripes on the part of the timeline segment past 15 s (live for the running draft), a red timer reading FOUL in the tag panel, "foul, N s" in the segment's hover text and "N s · foul" in red in the log's Length cell. The legend lists it. Statistics are unchanged (STA-8 already has a "15 s or more" bucket).
  - **Width:** the player column of the video and tagging screens is exactly as wide as the video (70 % of the window height × aspect ratio in the default view, the cinema heights of ADR-0025 in cinema mode, never more than the space available), and the grid is centered, so the seek bar or timeline and the controls line up with the video's edges and the side panel sits next to it.
- **Consequences:** On a short, wide window there is empty space on both sides of the player + panel rather than between them. Fouls are not counted anywhere in the statistics; that would be a separate decision.

## ADR-0030 · Edit a saved possession in the tag panel; read-only log; Z/7 renamed Z

- **Status:** Accepted · 2026-10-02 (requested by the user; edit-mode keys, save/cancel and the draft's handling chosen by Claude) · Amends TAG-6, TAG-7, ADR-0028
- **Context:** The log's inline dropdowns were hard to use and, in Chrome on Windows with the dark theme, their open lists were nearly unreadable (the list takes the select's transparent background, so light text sat on white). The user wants to edit a shot in the tag panel instead, and the Z/7 shot direction to be called Z.
- **Decision:**
  - **Open for editing:** clicking a timeline segment or a log row (or its start time) seeks 1 s before the possession, as before, and opens it in the tag panel; clicking the shot time seeks to the shot. The row and the segment are highlighted; the panel shows "Editing possession N" with a blue border.
  - **Edit mode:** the panel shows the possession's values. Tag keys and buttons change them as for a draft (pressing the selected value blanks it, C flips Straight ⇄ Z). R / F set the start / shot to the current time, refused outside the game or out of order. V marks it No shot, blanking the shot fields, without saving and without moving the times. Changes are held in the panel until **Enter / Save changes**, which writes them through the queue; **Esc / Backspace / Cancel** drops them. Opening another possession drops unsaved changes and says so. Deleting or undoing the open possession closes the edit. Review status is unchanged by an edit.
  - **The new-possession draft** is set aside while editing (still drawn on the timeline) and comes back afterwards; edit mode is not kept across a reload.
  - **Log:** read-only. Tag fields are plain text; the ⌖ set-to-current-time buttons are gone (R / F in edit mode replace them). Delete (×, one confirmation) and Confirm / Reject for candidates stay.
  - **Z:** shot direction values are `Straight`, `Z`. Migration `0005_shot_direction_z.sql` renames stored `Z/7` to `Z` and changes the check constraint; a draft kept in localStorage with Z/7 loads as Z.
  - **Dropdowns:** `option` elements get explicit `--panel` / `--ink` colors so every open list is readable on Windows.
- **Consequences:** Editing a field takes a click and Enter instead of one dropdown change. Apply migration 0005 before deploying the frontend, and let pending writes sync first: a pending write still carrying Z/7 would be refused.

## ADR-0031 · Hole keys follow the goal as seen in the video

- **Status:** Accepted · 2026-10-02 (requested by the user) · Amends ADR-0026, TAG-1
- **Context:** Keys 1–5 ran Pull long → Push long, which matches the goal on screen when I stand on the left of the frame. Standing on the right, the goal is upside down in the video, so the keys ran against it.
- **Decision:** The hole keys depend on the game's `my_side`. On the left, unchanged: 1 Pull long, 2 Pull short, 3 Middle, 4 Push short, 5 Push long. On the right, reversed: 1 Push long, 2 Push short, 3 Middle, 4 Pull short, 5 Pull long. The tag panel's Hole buttons and the keyboard map in the help follow the same order, so buttons and keys always line up. Stored values are unchanged (a hole is still seen from the shooter). Only the holes are mirrored; Setup (A S D) and the other keys stay as they are.
- **Consequences:** Muscle memory for 1–5 differs between left and right games. Changing a game's side on the video screen changes its hole keys the next time its tagging screen opens.

## ADR-0032 · "How to tag" under the timeline

- **Status:** Accepted · 2026-10-02 (requested by the user; placement chosen by Claude) · Amends TAG-8
- **Context:** The collapsible "How to tag" help sat at the end of the game numbers, far from the tag panel it explains.
- **Decision:** It moves into the player column, directly under the timeline and beside the tag panel. It stays out of the panel itself because the keyboard map (about 500 px) is wider than the panel (350 px). Cinema mode hides it, keeping that view to the player and its panel (ADR-0025).
- **Consequences:** Opened, it pushes the game numbers and log further down the page.


## ADR-0033 · No Undo button in the tag panel

- **Status:** Accepted · 2026-10-02 (requested by the user) · Amends ADR-0021
- **Context:** The tag panel had an Undo button next to Save and Clear; a click deletes the last saved possession, which is easy to hit by accident.
- **Decision:** The button goes. Undo stays on the keyboard (⌘Z / Ctrl+Z), as listed in "How to tag". Deleting any possession is still possible from the log.
- **Consequences:** Undo is keyboard-only.
