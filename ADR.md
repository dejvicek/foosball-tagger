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

- **Status:** Accepted · 2026-09-23 (to be measured in build step 3)
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
