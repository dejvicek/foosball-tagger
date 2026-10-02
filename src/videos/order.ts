import type { Game } from '../data/types'

/** Games in time order; ties by creation. */
export function sortGames(games: readonly Game[]): Game[] {
  return [...games].sort((a, b) => a.start_s - b.start_s || a.created_at.localeCompare(b.created_at))
}
