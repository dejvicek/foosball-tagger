import type { Format, ShotType } from '../data/types'
import type { StatItem } from './types'

/** STA-4 filters. Empty / null means "all". */
export interface StatFilters {
  shotTypes: ShotType[]
  format: Format | null
  /** '' selects possessions from games without an opponent. */
  opponent: string | null
}

export const NO_FILTERS: StatFilters = { shotTypes: [], format: null, opponent: null }

/** Statistics use confirmed possessions only (PRD §5). */
export function confirmedOnly<T extends Pick<StatItem, 'review_status'>>(items: readonly T[]): T[] {
  return items.filter((p) => p.review_status === 'confirmed')
}

export function applyFilters(items: readonly StatItem[], f: StatFilters): StatItem[] {
  return items.filter(
    (p) =>
      (f.shotTypes.length === 0 || (p.shot_type != null && f.shotTypes.includes(p.shot_type))) &&
      (f.format == null || p.format === f.format) &&
      (f.opponent == null || (p.opponent ?? '') === f.opponent),
  )
}

/** Opponents present in the scope, for the filter menu. */
export function opponentsOf(items: readonly StatItem[]): string[] {
  return [...new Set(items.map((p) => p.opponent ?? ''))].sort((a, b) => a.localeCompare(b))
}
