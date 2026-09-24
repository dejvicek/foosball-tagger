import { getSupabase } from './supabase'
import { toDataError } from './errors'
import type { WriteQueue } from './queue'
import type { Game, Possession, VideoSummary } from './types'
import { listVideos, getVideo } from './videos'
import type { StatItem } from '../stats/types'

export type StatScope =
  | { kind: 'game'; videoId: string; gameId: string }
  | { kind: 'video'; videoId: string }
  /** Inclusive calendar dates; null = open-ended. */
  | { kind: 'range'; from: string | null; to: string | null }

/** A video's date for date ranges: recorded date, else the day it was added (ADR-0014, ADR-0020). */
export function videoDate(v: Pick<VideoSummary, 'recorded_on' | 'created_at'>): string {
  return v.recorded_on ?? v.created_at.slice(0, 10)
}

const CHUNK = 100

async function inChunks<T>(ids: string[], fetch: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += CHUNK) out.push(...(await fetch(ids.slice(i, i + CHUNK))))
  return out
}

/**
 * Possessions in a scope with their game and video context. Pending writes are
 * replayed first and laid over the fetched rows, so unsynced tags count too.
 * Returns all review states; the caller keeps the confirmed ones.
 */
export async function loadStatItems(queue: WriteQueue, scope: StatScope): Promise<StatItem[]> {
  await queue.flush()
  const db = getSupabase()

  let videos: VideoSummary[]
  if (scope.kind === 'range') {
    videos = (await listVideos()).filter((v) => {
      const d = videoDate(v)
      return (scope.from == null || d >= scope.from) && (scope.to == null || d <= scope.to)
    })
  } else {
    const v = await getVideo(scope.videoId)
    videos = v ? [v] : []
  }
  if (videos.length === 0) return []
  const videoById = new Map(videos.map((v) => [v.id, v]))

  let games = await inChunks([...videoById.keys()], async (chunk) => {
    const { data, error } = await db.from('games').select('*').in('video_id', chunk)
    if (error) throw toDataError(error, 'load the games')
    return data
  })
  games = queue.overlay('games', games, (row) => videoById.has(row.video_id as string))
  if (scope.kind === 'game') games = games.filter((g) => g.id === scope.gameId)
  const gameById = new Map<string, Game>(games.map((g) => [g.id, g]))
  if (gameById.size === 0) return []

  let possessions = await inChunks([...gameById.keys()], async (chunk) => {
    const { data, error } = await db.from('possessions').select('*').in('game_id', chunk)
    if (error) throw toDataError(error, 'load the possessions')
    return data
  })
  possessions = queue.overlay('possessions', possessions, (row) => gameById.has(row.game_id as string))

  return possessions.flatMap((p: Possession) => {
    const game = gameById.get(p.game_id)
    const video = game && videoById.get(game.video_id)
    if (!game || !video) return []
    return [toStatItem(p, game, video)]
  })
}

export function toStatItem(p: Possession, game: Game, video: Pick<VideoSummary, 'id' | 'recorded_on' | 'created_at'>): StatItem {
  return {
    id: p.id,
    start_s: p.start_s,
    shot_s: p.shot_s,
    setup: p.setup,
    shot_type: p.shot_type,
    direction: p.direction,
    hole: p.hole,
    result: p.result,
    execution: p.execution,
    review_status: p.review_status,
    gameId: game.id,
    videoId: video.id,
    format: game.format,
    opponent: game.opponent,
    date: videoDate(video),
  }
}
