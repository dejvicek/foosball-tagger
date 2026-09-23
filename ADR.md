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

- **Status:** Accepted · 2026-09-23 (implemented in build steps 3–4)
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
