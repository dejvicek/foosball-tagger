import { getSupabase } from './supabase'
import { toDataError } from './errors'
import type { WriteQueue } from './queue'
import type { Game, Possession, VideoSummary } from './types'
import { listVideos, getVideo } from './videos'
import type { StatItem } from '../stats/types'
import { gameOpponents } from '../stats/filters'

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

/** Everything in a scope: its videos, their games (one in game scope) and those games' possessions, all review states. */
export interface ScopeData {
  videos: VideoSummary[]
  games: Game[]
  possessions: Possession[]
}

const EMPTY: ScopeData = { videos: [], games: [], possessions: [] }

/**
 * Loads a scope for statistics and export. Pending writes are replayed first and
 * laid over the fetched rows, so unsynced tags count too.
 */
export async function loadScope(queue: WriteQueue, scope: StatScope): Promise<ScopeData> {
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
  if (videos.length === 0) return EMPTY
  const videoIds = new Set(videos.map((v) => v.id))

  let games = await inChunks([...videoIds], async (chunk) => {
    const { data, error } = await db.from('games').select('*').in('video_id', chunk)
    if (error) throw toDataError(error, 'load the games')
    return data
  })
  games = queue.overlay('games', games, (row) => videoIds.has(row.video_id as string))
  const gameIds = new Set((scope.kind === 'game' ? games.filter((g) => g.id === scope.gameId) : games).map((g) => g.id))
  if (gameIds.size === 0) return { videos, games, possessions: [] }

  let possessions = await inChunks([...gameIds], async (chunk) => {
    const { data, error } = await db.from('possessions').select('*').in('game_id', chunk)
    if (error) throw toDataError(error, 'load the possessions')
    return data
  })
  possessions = queue.overlay('possessions', possessions, (row) => gameIds.has(row.game_id as string))
  // All of a video's games are kept so game numbers stay right; possessions are the scope's only.
  return { videos, games, possessions }
}

/** The scope's possessions with their game and video context; the caller keeps the confirmed ones. */
export function scopeItems(data: ScopeData): StatItem[] {
  const gameById = new Map(data.games.map((g) => [g.id, g]))
  const videoById = new Map(data.videos.map((v) => [v.id, v]))
  return data.possessions.flatMap((p) => {
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
    hole: p.hole,
    shot_direction: p.shot_direction,
    result: p.result,
    execution: p.execution,
    review_status: p.review_status,
    gameId: game.id,
    videoId: video.id,
    format: game.format,
    opponents: gameOpponents(game),
    date: videoDate(video),
  }
}
