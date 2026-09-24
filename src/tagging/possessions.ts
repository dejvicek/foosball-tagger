// Pure helpers over possession rows for the timeline and log (TAG-6, TAG-7).
import type { Possession } from '../data/types'
import type { Draft } from './draft'

/** Where a possession sits in time: its start, else its shot. */
export function anchor(p: Pick<Possession, 'start_s' | 'shot_s'>): number | null {
  return p.start_s ?? p.shot_s
}

export function sortPossessions(list: readonly Possession[]): Possession[] {
  const key = (p: Possession) => anchor(p) ?? Number.POSITIVE_INFINITY
  return [...list].sort((a, b) => key(a) - key(b) || a.created_at.localeCompare(b.created_at))
}

/** Derived, never stored (PRD §5). */
export function possessionLength(p: Pick<Possession, 'start_s' | 'shot_s'>): number | null {
  return p.start_s != null && p.shot_s != null ? p.shot_s - p.start_s : null
}

export type Outcome = 'goal' | 'nogoal' | 'noshot' | 'untagged' | 'candidate'

/** Timeline class (TAG-6). Unreviewed candidates get their own style whatever their tags. */
export function outcomeOf(p: Pick<Possession, 'shot_type' | 'result' | 'review_status'>): Outcome {
  if (p.review_status === 'unreviewed') return 'candidate'
  if (p.shot_type === 'No shot') return 'noshot'
  if (p.result === 'Goal') return 'goal'
  if (p.result === 'No goal') return 'nogoal'
  return 'untagged'
}

export const OUTCOME_LABEL: Record<Outcome | 'draft', string> = {
  goal: 'Goal',
  nogoal: 'No goal',
  noshot: 'No shot',
  untagged: 'Untagged',
  candidate: 'Unreviewed candidate',
  draft: 'Current possession',
}

/** Hover text: number and tags (TAG-6). */
export function describe(p: Possession, n: number): string {
  const tags = [p.setup, p.shot_type, p.direction, p.hole, p.result, p.execution].filter(Boolean).join(' · ')
  return `#${n}${tags ? ` ${tags}` : ' (no tags)'}${p.review_status === 'unreviewed' ? ' — unreviewed' : ''}`
}

/** The possession whose range contains `t` (for the log highlight, TAG-7). */
export function possessionAt(list: readonly Possession[], t: number): Possession | null {
  return list.find((p) => p.start_s != null && p.shot_s != null && t >= p.start_s && t <= p.shot_s) ?? null
}

export interface NewPossessionInput {
  id: string
  userId: string
  gameId: string
  now: string
}

/** A manual, confirmed possession from a saved draft (PRD §5). */
export function fromDraft(d: Draft, input: NewPossessionInput): Possession {
  return {
    id: input.id,
    user_id: input.userId,
    game_id: input.gameId,
    start_s: d.start_s,
    shot_s: d.shot_s,
    setup: d.setup,
    shot_type: d.shot_type,
    direction: d.direction,
    hole: d.hole,
    result: d.result,
    execution: d.execution,
    source: 'manual',
    confidence: null,
    review_status: 'confirmed',
    created_at: input.now,
    updated_at: input.now,
  }
}
