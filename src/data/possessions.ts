import { getSupabase } from './supabase'
import { toDataError } from './errors'
import type { WriteQueue } from './queue'
import type { Possession } from './types'

/** Possessions of a game: pending writes first, then fetched rows overlaid with what is still pending (SYN-4). */
export async function loadPossessions(queue: WriteQueue, gameId: string): Promise<Possession[]> {
  await queue.flush()
  const { data, error } = await getSupabase().from('possessions').select('*').eq('game_id', gameId).order('start_s')
  if (error) throw toDataError(error, 'load the possessions')
  return queue.overlay('possessions', data, (row) => row.game_id === gameId)
}

/** Optimistic write through the pending queue (SYN-1); edits pass a debounce (SYN-3). */
export function savePossession(queue: WriteQueue, p: Possession, flushDelayMs = 0): void {
  queue.upsert('possessions', p, flushDelayMs)
}

export function deletePossession(queue: WriteQueue, id: string): void {
  queue.remove('possessions', id)
}
