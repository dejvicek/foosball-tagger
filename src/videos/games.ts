// Game boundaries on a video (GAM-1, GAM-2, GAM-4, ADR-0040). Pure functions over game rows.
import type { Game, Match, Side } from '../data/types'
import { formatTime } from '../player/time'
import { gameLabel, interleaveProblem, matchGames } from './matches'
import { sortGames } from './order'

export { sortGames }

export function openGame(games: readonly Game[]): Game | undefined {
  return games.find((g) => g.end_s == null)
}

/**
 * The time range a game covers. An open game runs until the next game starts, or
 * to the end of the video (ADR-0010, ADR-0017).
 */
export function gameRange(game: Game, games: readonly Game[], duration: number | null): { start: number; end: number } {
  if (game.end_s != null) return { start: game.start_s, end: game.end_s }
  const next = sortGames(games).find((g) => g.id !== game.id && g.start_s > game.start_s)
  return { start: game.start_s, end: next?.start_s ?? duration ?? Number.POSITIVE_INFINITY }
}

const t = (s: number) => formatTime(s)

/** The first rule this set of games breaks, or null (GAM-4: games may not overlap). */
export function validateGames(games: readonly Game[], matches: readonly Match[], duration: number | null): string | null {
  const label = (g: Game) => gameLabel(matches, games, g)
  const sorted = sortGames(games)
  const open = sorted.filter((g) => g.end_s == null)
  if (open.length > 1) return `Only one game can be open at a time: end ${label(open[0] as Game)} first.`

  for (const g of sorted) {
    if (g.start_s < 0) return `${label(g)} would start before the video.`
    if (duration != null && g.start_s >= duration) return `${label(g)} would start after the end of the video.`
    if (g.end_s != null && g.end_s <= g.start_s) return `${label(g)} would end before it starts.`
    if (duration != null && g.end_s != null && g.end_s > duration + 0.5) return `${label(g)} would end after the video.`
  }
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1] as Game
    const b = sorted[i] as Game
    if (b.start_s === a.start_s || (a.end_s != null && a.end_s > b.start_s)) {
      const range = a.end_s != null ? `${t(a.start_s)}–${t(a.end_s)}` : `from ${t(a.start_s)}`
      return `${label(a)} (${range}) and ${label(b)} (from ${t(b.start_s)}) would overlap. Games may not overlap.`
    }
  }
  return interleaveProblem(matches, games)
}

/** my_side for a new game: that of the game before it on the same video (GAM-2), else the latest one. */
export function defaultSide(games: readonly Game[], at: number): Side | null {
  const sorted = sortGames(games)
  const before = sorted.filter((g) => g.start_s <= at).at(-1)
  return (before ?? sorted.at(-1))?.my_side ?? null
}

export type Plan = { ok: true; games: Game[]; save: Game[]; message: string } | { ok: false; message: string }

export interface NewGameInput {
  id: string
  userId: string
  videoId: string
  now: string
  side: Side | null
  matchId: string
}

/** B: start a game at `at`, closing the open one there first (GAM-1). */
export function startGame(
  games: readonly Game[],
  matches: readonly Match[],
  at: number,
  input: NewGameInput,
  duration: number | null,
): Plan {
  const label = (g: Game) => gameLabel(matches, games, g)
  if (!input.side) {
    return { ok: false, message: 'Choose which side of the frame you stand on before starting the first game.' }
  }
  const sorted = sortGames(games)
  const inside = sorted.find((g) => g.end_s != null && at >= g.start_s && at < g.end_s)
  if (inside) {
    return {
      ok: false,
      message: `${t(at)} is inside ${label(inside)} (${t(inside.start_s)}–${t(inside.end_s as number)}). Seek outside it, or change that game’s boundaries.`,
    }
  }

  const save: Game[] = []
  let next = [...games]
  let closedLabel: string | null = null
  const open = openGame(games)
  if (open) {
    if (at <= open.start_s) {
      return {
        ok: false,
        message: `${label(open)} is still open and starts at ${t(open.start_s)}, after this time. End it with E first.`,
      }
    }
    const closed = { ...open, end_s: at, updated_at: input.now }
    next = next.map((g) => (g.id === open.id ? closed : g))
    save.push(closed)
    closedLabel = label(open)
  }

  const created: Game = {
    id: input.id,
    user_id: input.userId,
    video_id: input.videoId,
    match_id: input.matchId,
    start_s: at,
    end_s: null,
    my_side: input.side,
    my_score: null,
    opp_score: null,
    notes: null,
    created_at: input.now,
    updated_at: input.now,
  }
  next.push(created)
  const problem = validateGames(next, matches, duration)
  if (problem) return { ok: false, message: problem }
  save.push(created)
  const n = gameLabel(matches, next, created)
  const match = matches.find((m) => m.id === input.matchId)
  const before = matchGames(games, input.matchId).length
  const warn = match?.best_of != null && before >= match.best_of ? ` BO${match.best_of} already had ${before} ${before === 1 ? 'game' : 'games'}.` : ''
  return {
    ok: true,
    games: next,
    save,
    message: (closedLabel ? `Ended ${closedLabel} and started ${n} at ${t(at)}.` : `Started ${n} at ${t(at)}.`) + warn,
  }
}

/** E: end the open game at `at` (GAM-1). */
export function endGame(games: readonly Game[], matches: readonly Match[], at: number, now: string, duration: number | null): Plan {
  const open = openGame(games)
  if (!open) return { ok: false, message: 'No game is open. Press B where a game starts.' }
  const label = (g: Game) => gameLabel(matches, games, g)
  if (at <= open.start_s) {
    return { ok: false, message: `${t(at)} is before the start of ${label(open)} (${t(open.start_s)}).` }
  }
  const closed = { ...open, end_s: at, updated_at: now }
  const next = games.map((g) => (g.id === open.id ? closed : g))
  const problem = validateGames(next, matches, duration)
  if (problem) return { ok: false, message: problem }
  return { ok: true, games: next, save: [closed], message: `Ended ${label(open)} at ${t(at)}.` }
}

/** Moves one boundary of a game to `at`, keeping every rule (GAM-4, TAG-5). */
export function setBoundary(
  games: readonly Game[],
  matches: readonly Match[],
  id: string,
  which: 'start' | 'end',
  at: number,
  now: string,
  duration: number | null,
): Plan {
  const game = games.find((g) => g.id === id)
  if (!game) return { ok: false, message: 'That game no longer exists.' }
  const changed = which === 'start' ? { ...game, start_s: at, updated_at: now } : { ...game, end_s: at, updated_at: now }
  const next = games.map((g) => (g.id === id ? changed : g))
  const problem = validateGames(next, matches, duration)
  if (problem) return { ok: false, message: problem }
  return {
    ok: true,
    games: next,
    save: [changed],
    message: `${gameLabel(matches, next, changed)} now ${which === 'start' ? 'starts' : 'ends'} at ${t(at)}.`,
  }
}
