import { getSupabase } from './supabase'
import { toDataError } from './errors'
import type { WriteQueue } from './queue'
import type { Game } from './types'

/**
 * Games of a video: pending writes are replayed first, then fetched rows are
 * overlaid with whatever is still pending (SYN-4).
 */
export async function loadGames(queue: WriteQueue, videoId: string): Promise<Game[]> {
  await queue.flush()
  const { data, error } = await getSupabase().from('games').select('*').eq('video_id', videoId).order('start_s')
  if (error) throw toDataError(error, 'load the games')
  return queue.overlay('games', data, (row) => row.video_id === videoId)
}

/** Possessions per game, for delete confirmations (all review states). */
export async function possessionCounts(gameIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (gameIds.length === 0) return counts
  const { data, error } = await getSupabase().from('possessions').select('game_id').in('game_id', gameIds)
  if (error) throw toDataError(error, 'count the possessions')
  for (const row of data) counts.set(row.game_id, (counts.get(row.game_id) ?? 0) + 1)
  return counts
}

/** Optimistic writes through the pending queue (SYN-1). */
export function saveGame(queue: WriteQueue, game: Game, flushDelayMs = 0): void {
  queue.upsert('games', game, flushDelayMs)
}

export function deleteGame(queue: WriteQueue, id: string): void {
  queue.remove('games', id, [{ table: 'possessions', fk: 'game_id' }])
}
