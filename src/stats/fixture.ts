// Loads a fixture file (fixtures/*.json) as StatItems. Test-only helper.
import type { Possession } from '../data/types'
import type { StatItem } from './types'

export interface Fixture {
  description: string
  video: { id: string; recorded_on: string }
  game: { id: string; format: StatItem['format']; opponent: string | null }
  possessions: Omit<Possession, 'user_id' | 'created_at' | 'updated_at'>[]
}

export function fixtureItems(f: Fixture): StatItem[] {
  return f.possessions.map((p) => ({
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
    gameId: f.game.id,
    videoId: f.video.id,
    format: f.game.format,
    opponent: f.game.opponent,
    date: f.video.recorded_on,
  }))
}
