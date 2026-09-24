// Statistics over confirmed possessions (STA-1..10). Pure functions.
//
// Blank fields are left out of denominators, never counted as failures (STA-1):
// conversion counts only shots with a result, proper rate only shots with an
// execution, and so on.
import { DIRECTIONS, HOLES, SHOT_TYPES, type Direction, type Hole, type Setup, type ShotType } from '../data/types'
import { ratio } from './ratio'
import type { Ratio, StatItem } from './types'

type P = Pick<StatItem, 'start_s' | 'shot_s' | 'setup' | 'shot_type' | 'direction' | 'hole' | 'result' | 'execution'>

/**
 * Whether a possession ended in a shot. "No shot" → no; a shot type → yes; no type
 * but a shot time (F was pressed) → yes; neither → unknown, left out (ADR-0020).
 */
export function shotStatus(p: P): 'shot' | 'noShot' | 'unknown' {
  if (p.shot_type === 'No shot') return 'noShot'
  if (p.shot_type != null || p.shot_s != null) return 'shot'
  return 'unknown'
}

export const isShot = (p: P) => shotStatus(p) === 'shot'

export function lengthOf(p: P): number | null {
  return p.start_s != null && p.shot_s != null ? p.shot_s - p.start_s : null
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2
}

export function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

/** Goals among shots with a result. */
export function conversion(shots: readonly P[]): Ratio {
  const withResult = shots.filter((p) => p.result != null)
  return ratio(withResult.filter((p) => p.result === 'Goal').length, withResult.length)
}

/** Proper among shots with an execution. */
export function properRate(shots: readonly P[]): Ratio {
  const judged = shots.filter((p) => p.execution != null)
  return ratio(judged.filter((p) => p.execution === 'Proper').length, judged.length)
}

export interface Headline {
  possessions: number
  shots: number
  conversion: Ratio
  proper: Ratio
  medianLength: number | null
  /** Median over this many possessions with both times. */
  medianOf: number
  /** No-shot possessions among those whose outcome is known. */
  noShotShare: Ratio
}

/** STA-5 */
export function headline(items: readonly P[]): Headline {
  const shots = items.filter(isShot)
  const known = items.filter((p) => shotStatus(p) !== 'unknown')
  const lengths = items.map(lengthOf).filter((v): v is number => v != null)
  return {
    possessions: items.length,
    shots: shots.length,
    conversion: conversion(shots),
    proper: properRate(shots),
    medianLength: median(lengths),
    medianOf: lengths.length,
    noShotShare: ratio(known.filter((p) => shotStatus(p) === 'noShot').length, known.length),
  }
}

export interface ShotRow {
  shotType: ShotType | null
  direction: Direction | null
  hole: Hole | null
  attempts: number
  goals: number
  conversion: Ratio
  proper: Ratio
  avgLength: number | null
  /** Average over this many shots with both times. */
  avgOf: number
}

const order = <T,>(list: readonly T[], v: T | null) => (v == null ? list.length : list.indexOf(v))

/** STA-6: shots grouped by type + direction + hole, most attempts first. */
export function byShot(items: readonly P[]): ShotRow[] {
  const groups = new Map<string, P[]>()
  for (const p of items.filter(isShot)) {
    const k = `${p.shot_type}|${p.direction}|${p.hole}`
    groups.set(k, [...(groups.get(k) ?? []), p])
  }
  const rows = [...groups.values()].map((list): ShotRow => {
    const first = list[0] as P
    const lengths = list.map(lengthOf).filter((v): v is number => v != null)
    return {
      shotType: first.shot_type,
      direction: first.direction,
      hole: first.hole,
      attempts: list.length,
      goals: list.filter((p) => p.result === 'Goal').length,
      conversion: conversion(list),
      proper: properRate(list),
      avgLength: mean(lengths),
      avgOf: lengths.length,
    }
  })
  return rows.sort(
    (a, b) =>
      b.attempts - a.attempts ||
      order(SHOT_TYPES, a.shotType) - order(SHOT_TYPES, b.shotType) ||
      order(DIRECTIONS, a.direction) - order(DIRECTIONS, b.direction) ||
      order(HOLES, a.hole) - order(HOLES, b.hole),
  )
}

export interface ExecutionRow {
  execution: 'Proper' | 'Misexecuted'
  goals: number
  noGoals: number
  conversion: Ratio
}

/** STA-7: 2×2 of execution × result over shots with both tagged. */
export function executionVsResult(items: readonly P[]): ExecutionRow[] {
  const both = items.filter((p) => isShot(p) && p.execution != null && p.result != null)
  return (['Proper', 'Misexecuted'] as const).map((execution) => {
    const row = both.filter((p) => p.execution === execution)
    const goals = row.filter((p) => p.result === 'Goal').length
    return { execution, goals, noGoals: row.length - goals, conversion: ratio(goals, row.length) }
  })
}

export const EXECUTION_NOTE =
  "Proper shots that don't score point to the goalie reading you (selection or disguise). Misexecuted shots that score are luck you can't rely on."

export interface GroupRow {
  label: string
  attempts: number
  conversion: Ratio
  proper: Ratio
  /** For sub-rows (e.g. Pull side under Off-middle). */
  indent?: boolean
}

function group(label: string, shots: readonly P[], indent = false): GroupRow {
  return { label, attempts: shots.length, conversion: conversion(shots), proper: properRate(shots), ...(indent ? { indent } : {}) }
}

export const LENGTH_BUCKETS = [
  { label: 'Under 5 s', from: 0, to: 5 },
  { label: '5–10 s', from: 5, to: 10 },
  { label: '10–15 s', from: 10, to: 15 },
  { label: '15 s or more', from: 15, to: Number.POSITIVE_INFINITY },
] as const

/** STA-8: conversion by possession length; shots with both times only. Buckets include their lower bound. */
export function byLength(items: readonly P[]): GroupRow[] {
  const timed = items.filter((p) => isShot(p) && lengthOf(p) != null)
  return LENGTH_BUCKETS.map((b) =>
    group(
      b.label,
      timed.filter((p) => {
        const len = lengthOf(p) as number
        return len >= b.from && len < b.to
      }),
    ),
  )
}

/** STA-9: Middle vs. off-middle (with its two sides), shots with a setup only. */
export function bySetup(items: readonly P[]): GroupRow[] {
  const shots = items.filter((p) => isShot(p) && p.setup != null)
  const is = (s: Setup) => (p: P) => p.setup === s
  return [
    group('Middle', shots.filter(is('Middle'))),
    group('Off-middle', shots.filter((p) => p.setup !== 'Middle')),
    group('Pull side', shots.filter(is('Pull side')), true),
    group('Push side', shots.filter(is('Push side')), true),
  ]
}

/** STA-10: conversion per hole lane, shots with a hole only. */
export function byHole(items: readonly P[]): GroupRow[] {
  const shots = items.filter((p) => isShot(p) && p.hole != null)
  return HOLES.map((h) => group(h, shots.filter((p) => p.hole === h)))
}
