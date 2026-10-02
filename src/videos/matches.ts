// Matches on a video (ADR-0040). Pure functions over match and game rows.
import type { Game, Match } from '../data/types'
import { formatTime } from '../player/time'
import { matchOpponents } from '../stats/filters'
import { sortGames } from './order'

export { matchOpponents }

/** A match's games in time order. */
export function matchGames(games: readonly Game[], matchId: string): Game[] {
  return sortGames(games.filter((g) => g.match_id === matchId))
}

/** Matches in time order: by their first game's start; empty matches last, by creation. */
export function sortMatches(matches: readonly Match[], games: readonly Game[]): Match[] {
  const first = new Map<string, number>()
  for (const g of games) first.set(g.match_id, Math.min(first.get(g.match_id) ?? Number.POSITIVE_INFINITY, g.start_s))
  const at = (m: Match) => first.get(m.id) ?? Number.POSITIVE_INFINITY
  // Infinity − Infinity is NaN (falsy), so two empty matches fall through to creation order.
  return [...matches].sort((a, b) => at(a) - at(b) || a.created_at.localeCompare(b.created_at))
}

/** 1-based number of a match on its video, as shown and exported (match_index). */
export function matchNumber(matches: readonly Match[], games: readonly Game[], matchId: string): number {
  return sortMatches(matches, games).findIndex((m) => m.id === matchId) + 1
}

/** 1-based number of a game within its match, as shown and exported (game_index). */
export function gameInMatch(games: readonly Game[], game: Game): number {
  return matchGames(games, game.match_id).findIndex((g) => g.id === game.id) + 1
}

/** "Match 2 · Game 1". */
export function gameLabel(matches: readonly Match[], games: readonly Game[], game: Game): string {
  return `Match ${matchNumber(matches, games, game.match_id)} · Game ${gameInMatch(games, game)}`
}

/** The match B adds to: the selected one if it still exists, else the last in time order. */
export function currentMatch(matches: readonly Match[], games: readonly Game[], selectedId: string | null): Match | undefined {
  return matches.find((m) => m.id === selectedId) ?? sortMatches(matches, games).at(-1)
}

/** A match's games follow each other: no game of one match lies between games of another. */
export function interleaveProblem(matches: readonly Match[], games: readonly Game[]): string | null {
  const sorted = sortGames(games)
  const left = new Set<string>()
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1] as Game
    const g = sorted[i] as Game
    if (prev.match_id === g.match_id) continue
    left.add(prev.match_id)
    if (left.has(g.match_id)) {
      const [a, b] = [matchNumber(matches, games, g.match_id), matchNumber(matches, games, prev.match_id)].sort((x, y) => x - y)
      return `Match ${a} and Match ${b} would interleave at ${formatTime(g.start_s)}. A match’s games follow each other: start a new match with M, or select the match being played.`
    }
  }
  return null
}

export interface MatchResult {
  /** Games won and lost, counting only games with both scores entered; a tie counts for neither. */
  won: number
  lost: number
  /** All games of the match, scored or not. */
  games: number
  /** best_of is set and one side has more than half of it. */
  decided: boolean
  /** best_of is set and the match has more games than that. */
  over: boolean
}

export function matchResult(match: Pick<Match, 'id' | 'best_of'>, games: readonly Game[]): MatchResult {
  const mine = games.filter((g) => g.match_id === match.id)
  let won = 0
  let lost = 0
  for (const g of mine) {
    if (g.my_score == null || g.opp_score == null) continue
    if (g.my_score > g.opp_score) won++
    else if (g.my_score < g.opp_score) lost++
  }
  const b = match.best_of
  return { won, lost, games: mine.length, decided: b != null && Math.max(won, lost) > b / 2, over: b != null && mine.length > b }
}

/** "2–1 · BO3 · decided", "BO5", or '' when nothing is known. */
export function resultLabel(match: Pick<Match, 'id' | 'best_of'>, games: readonly Game[]): string {
  const r = matchResult(match, games)
  return [r.won + r.lost > 0 ? `${r.won}–${r.lost}` : '', match.best_of != null ? `BO${match.best_of}` : '', r.decided ? 'decided' : '']
    .filter(Boolean)
    .join(' · ')
}

export interface NewMatchInput {
  id: string
  userId: string
  videoId: string
  now: string
}

/** A new empty match, copying format, players and best-of from `from` (M, ADR-0040). */
export function newMatch(input: NewMatchInput, from: Match | undefined): Match {
  return {
    id: input.id,
    user_id: input.userId,
    video_id: input.videoId,
    best_of: from?.best_of ?? null,
    format: from?.format ?? 'singles',
    teammate: from?.teammate ?? null,
    opponent: from?.opponent ?? null,
    opponent2: from?.opponent2 ?? null,
    notes: null,
    created_at: input.now,
    updated_at: input.now,
  }
}
