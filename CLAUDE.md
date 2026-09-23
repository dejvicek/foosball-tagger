# Foosball Session Tagger

Single-user web app for tagging foosball games from YouTube recordings and computing practice statistics. React + TypeScript + Vite, Supabase (auth + Postgres with RLS), deployed to GitHub Pages. A later Python worker (`tracker/`) will detect possessions automatically.

**The product requirements are in `PRD.md`.** Read it before starting any task and refer to requirement ids (VID-1, TAG-3, STA-7…) in commits, tests and questions. `reference/foosball-tagger-v1.html` is the behavioral prototype for the tagging flow; the PRD overrides it where they differ.

**Decisions are recorded in `ADR.md`**, which overrides the PRD where they differ. Every architectural or product decision (including assumptions made for ambiguous requirements) gets a new numbered record there in the same commit, and the commit message cites it (ADR-0007…). Never rewrite an accepted record; supersede it.

## Layout

```
src/
  app/          routing, auth gate, layout
  videos/       video list and video screen
  player/       YouTube IFrame wrapper, time polling, focus capture, overlay
  tagging/      tag panel state machine, keyboard map, timeline, log
  stats/        pure statistics functions — no React, no Supabase imports
  data/         Supabase client, typed queries, pending write queue
  export/       CSV generation
supabase/migrations/   SQL migrations (never edit an applied one)
tracker/        Python worker (later)
fixtures/       hand-tagged game used by tests and by worker validation
docs/           manual-tests.md and notes
```

## Commands

- `npm run dev` — local dev server (http://localhost:5173)
- `npm run build` / `npm run preview`
- `npm test` — Vitest; run before every commit
- `npm run lint` (oxlint) and `npm run typecheck` (tsc) — must pass before a task is done
- `npx supabase db push` — apply migrations to the linked project (user runs this; tell them when). Migrations are tested against PGlite in `supabase/tests/` as part of `npm test`.

## Conventions

- TypeScript strict mode; no `any` without a comment saying why.
- All times are seconds from the start of the YouTube video, as `number`; never Date objects for video time.
- Category values (setup, shot_type, direction, hole, result, execution) are string literal unions defined once in `src/data/types.ts`, mirroring the SQL `CHECK` constraints. Change both together, via a new migration.
- Statistics: pure functions, unit-tested against `fixtures/`, every percentage carries its numerator and denominator. Blank fields are excluded from denominators, never counted as failures.
- Tag buttons never take focus on click (`pointerdown` → `preventDefault`) so Space and Enter keep their meanings.
- Writes are optimistic and go through the pending queue in `src/data/queue.ts`; never call Supabase directly from a component.
- No secrets in the repo. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` reach the frontend.

## Working with the user

- Follow the build order in PRD §10. Finish one step, make sure the app deploys, then list what the user should test by hand before moving on.
- Anything the user must do outside the repo (Supabase dashboard, GitHub secrets, YouTube settings) goes in a short numbered checklist at the end of your message.
- Do not add features beyond the PRD without asking. If a requirement is ambiguous, state the assumption you are making and proceed; ask only when the choice is hard to reverse (schema, key bindings, data semantics).
- Prefer small, reviewable commits with the requirement id in the message.
- The user's time is better spent at the foosball table than reviewing code: keep explanations short and lead with what changed and what to test.

## Definition of done for a task

- Requirement behavior matches the PRD, including error states named there.
- Tests added or updated; `npm test`, `lint` and `typecheck` pass.
- `docs/manual-tests.md` updated if the feature has a manual check.
- The deployed app still works.
