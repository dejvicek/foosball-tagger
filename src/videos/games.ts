// Game boundaries on a video (GAM-1, GAM-2, GAM-4). Pure functions over game rows.
import type { Format, Game, Side } from '../data/types'
import { formatTime } from '../player/time'

export function sortGames(games: readonly Game[]): Game[] {
  return [...games].sort((a, b) => a.start_s - b.start_s || a.created_at.localeCompare(b.created_at))
}

/** 1-based number of a game in time order, as shown and exported (game_index). */
export function gameNumber(games: readonly Game[], id: string): number {
  return sortGames(games).findIndex((g) => g.id === id) + 1
}

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

function label(sorted: Game[], g: Game): string {
  return `Game ${sorted.indexOf(g) + 1}`
}

/** The first rule this set of games breaks, or null (GAM-4: games may not overlap). */
export function validateGames(games: readonly Game[], duration: number | null): string | null {
  const sorted = sortGames(games)
  const open = sorted.filter((g) => g.end_s == null)
  if (open.length > 1) return `Only one game can be open at a time: end ${label(sorted, open[0] as Game)} first.`

  for (const g of sorted) {
    if (g.start_s < 0) return `${label(sorted, g)} would start before the video.`
    if (duration != null && g.start_s >= duration) return `${label(sorted, g)} would start after the end of the video.`
    if (g.end_s != null && g.end_s <= g.start_s) return `${label(sorted, g)} would end before it starts.`
    if (duration != null && g.end_s != null && g.end_s > duration + 0.5) return `${label(sorted, g)} would end after the video.`
  }
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1] as Game
    const b = sorted[i] as Game
    if (b.start_s === a.start_s || (a.end_s != null && a.end_s > b.start_s)) {
      const range = a.end_s != null ? `${t(a.start_s)}–${t(a.end_s)}` : `from ${t(a.start_s)}`
      return `${label(sorted, a)} (${range}) and ${label(sorted, b)} (from ${t(b.start_s)}) would overlap. Games may not overlap.`
    }
  }
  return null
}

/** my_side for a new game: that of the game before it on the same video (GAM-2), else the latest one. */
export function defaultSide(games: readonly Game[], at: number): Side | null {
  const sorted = sortGames(games)
  const before = sorted.filter((g) => g.start_s <= at).at(-1)
  return (before ?? sorted.at(-1))?.my_side ?? null
}

function defaultFormat(games: readonly Game[], at: number): Format {
  const sorted = sortGames(games)
  return (sorted.filter((g) => g.start_s <= at).at(-1) ?? sorted.at(-1))?.format ?? 'singles'
}

export type Plan = { ok: true; games: Game[]; save: Game[]; message: string } | { ok: false; message: string }

export interface NewGameInput {
  id: string
  userId: string
  videoId: string
  now: string
  side: Side | null
}

/** B: start a game at `at`, closing the open one there first (GAM-1). */
export function startGame(games: readonly Game[], at: number, input: NewGameInput, duration: number | null): Plan {
  if (!input.side) {
    return { ok: false, message: 'Choose which side of the frame your goal is on before starting the first game.' }
  }
  const sorted = sortGames(games)
  const inside = sorted.find((g) => g.end_s != null && at >= g.start_s && at < g.end_s)
  if (inside) {
    return {
      ok: false,
      message: `${t(at)} is inside ${label(sorted, inside)} (${t(inside.start_s)}–${t(inside.end_s as number)}). Seek outside it, or change that game’s boundaries.`,
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
        message: `${label(sorted, open)} is still open and starts at ${t(open.start_s)}, after this time. End it with E first.`,
      }
    }
    const closed = { ...open, end_s: at, updated_at: input.now }
    next = next.map((g) => (g.id === open.id ? closed : g))
    save.push(closed)
    closedLabel = label(sorted, open)
  }

  const created: Game = {
    id: input.id,
    user_id: input.userId,
    video_id: input.videoId,
    start_s: at,
    end_s: null,
    my_side: input.side,
    format: defaultFormat(games, at),
    opponent: null,
    my_score: null,
    opp_score: null,
    notes: null,
    created_at: input.now,
    updated_at: input.now,
  }
  next.push(created)
  const problem = validateGames(next, duration)
  if (problem) return { ok: false, message: problem }
  save.push(created)
  const n = gameNumber(next, created.id)
  return {
    ok: true,
    games: next,
    save,
    message: closedLabel ? `Ended ${closedLabel} and started Game ${n} at ${t(at)}.` : `Started Game ${n} at ${t(at)}.`,
  }
}

/** E: end the open game at `at` (GAM-1). */
export function endGame(games: readonly Game[], at: number, now: string, duration: number | null): Plan {
  const open = openGame(games)
  if (!open) return { ok: false, message: 'No game is open. Press B where a game starts.' }
  const sorted = sortGames(games)
  if (at <= open.start_s) {
    return { ok: false, message: `${t(at)} is before the start of ${label(sorted, open)} (${t(open.start_s)}).` }
  }
  const closed = { ...open, end_s: at, updated_at: now }
  const next = games.map((g) => (g.id === open.id ? closed : g))
  const problem = validateGames(next, duration)
  if (problem) return { ok: false, message: problem }
  return { ok: true, games: next, save: [closed], message: `Ended ${label(sorted, open)} at ${t(at)}.` }
}

/** Moves one boundary of a game to `at`, keeping every rule (GAM-4, TAG-5). */
export function setBoundary(
  games: readonly Game[],
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
  const problem = validateGames(next, duration)
  if (problem) return { ok: false, message: problem }
  return {
    ok: true,
    games: next,
    save: [changed],
    message: `Game ${gameNumber(next, id)} now ${which === 'start' ? 'starts' : 'ends'} at ${t(at)}.`,
  }
}
