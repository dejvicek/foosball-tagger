import type { Ratio } from './types'

/** Percentages resting on fewer attempts than this are marked as small samples (STA-3). */
export const SMALL_SAMPLE = 30

export function ratio(num: number, den: number): Ratio {
  return { num, den, pct: den > 0 ? (num / den) * 100 : null, small: den < SMALL_SAMPLE }
}

/** "58% (7/12)", or "– (0/0)" without a sample (STA-2). */
export function formatRatio(r: Ratio): string {
  return `${r.pct == null ? '–' : `${Math.round(r.pct)}%`} (${r.num}/${r.den})`
}
