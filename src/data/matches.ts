import { getSupabase } from './supabase'
import { toDataError } from './errors'
import type { WriteQueue } from './queue'
import type { Match } from './types'

/** Matches of a video, with pending writes laid over the fetched rows (SYN-4). */
export async function loadMatches(queue: WriteQueue, videoId: string): Promise<Match[]> {
  await queue.flush()
  const { data, error } = await getSupabase().from('matches').select('*').eq('video_id', videoId)
  if (error) throw toDataError(error, 'load the matches')
  return queue.overlay('matches', data, (row) => row.video_id === videoId)
}

/** Optimistic writes through the pending queue (SYN-1). */
export function saveMatch(queue: WriteQueue, match: Match, flushDelayMs = 0): void {
  queue.upsert('matches', match, flushDelayMs)
}

/** Deletes a match; the database cascade removes its games and their possessions. */
export function deleteMatch(queue: WriteQueue, id: string): void {
  queue.remove('matches', id, [{ table: 'games', fk: 'match_id', cascade: [{ table: 'possessions', fk: 'game_id' }] }])
}
