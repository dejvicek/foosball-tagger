import type { Execution, Format, Hole, Result, ReviewStatus, Setup, ShotDirection, ShotType } from '../data/types'

/** One possession with the context the filters need (STA-4). */
export interface StatItem {
  id: string
  start_s: number | null
  shot_s: number | null
  setup: Setup | null
  shot_type: ShotType | null
  hole: Hole | null
  shot_direction: ShotDirection | null
  result: Result | null
  execution: Execution | null
  review_status: ReviewStatus
  gameId: string
  matchId: string
  videoId: string
  format: Format
  /** Opponents' names in the match (one in singles, up to two in doubles); empty when none entered. */
  opponents: string[]
  /** Calendar date of the video (YYYY-MM-DD). */
  date: string
}

/**
 * A percentage that always carries its sample (STA-2). `pct` is null when the
 * denominator is 0; `small` marks fewer than 30 attempts (STA-3).
 */
export interface Ratio {
  num: number
  den: number
  pct: number | null
  small: boolean
}
