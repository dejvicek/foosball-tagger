// Pure helpers over possession rows for the timeline and log (TAG-6, TAG-7).
import type { Possession } from '../data/types'
import type { Draft } from './draft'

/** Where a possession sits in time: its start, else its shot. */
export function anchor(p: Pick<Possession, 'start_s' | 'shot_s'>): number | null {
  return p.start_s ?? p.shot_s
}

export function sortPossessions<P extends Possession>(list: readonly P[]): P[] {
  const key = (p: P) => anchor(p) ?? Number.POSITIVE_INFINITY
  return [...list].sort((a, b) => key(a) - key(b) || a.created_at.localeCompare(b.created_at))
}

/** Time order with the log's numbers: rejected rows are skipped and get null (TAG-7, exported as `n`). */
export function numberPossessions<P extends Possession>(list: readonly P[]): { p: P; n: number | null }[] {
  let n = 0
  return sortPossessions(list).map((p) => ({ p, n: p.review_status === 'rejected' ? null : ++n }))
}

/** Derived, never stored (PRD §5). */
export function possessionLength(p: Pick<Possession, 'start_s' | 'shot_s'>): number | null {
  return p.start_s != null && p.shot_s != null ? p.shot_s - p.start_s : null
}

/** The rule limit for one possession on the 3-bar; longer is a foul (ADR-0029). */
export const FOUL_LIMIT_S = 15

/** A foul: held longer than the limit. Shown, never stored; the tags stay as entered (ADR-0029). */
export function isFoul(length: number | null): boolean {
  return length != null && length > FOUL_LIMIT_S
}

/** Fill color of a timeline segment (ADR-0037); No shot is hollow instead. */
export type ResultLook = 'goal' | 'nogoal' | 'noresult' | 'noshot'
/** Pattern of a timeline segment (ADR-0037): solid, striped, faded. */
export type ExecutionLook = 'proper' | 'mis' | 'blank'

export interface SegmentLook {
  result: ResultLook
  /** Null for No shot, which has no execution. */
  execution: ExecutionLook | null
  /** Unreviewed candidate: a dashed outline over the tags' look. */
  candidate: boolean
  foul: boolean
}

/** How a possession is drawn on the timeline (TAG-6, ADR-0037). */
export function segmentLook(p: Pick<Possession, 'start_s' | 'shot_s' | 'shot_type' | 'result' | 'execution' | 'review_status'>): SegmentLook {
  const noShot = p.shot_type === 'No shot'
  const result: ResultLook = noShot ? 'noshot' : p.result === 'Goal' ? 'goal' : p.result === 'No goal' ? 'nogoal' : 'noresult'
  const execution: ExecutionLook | null = noShot ? null : p.execution === 'Proper' ? 'proper' : p.execution === 'Misexecuted' ? 'mis' : 'blank'
  return { result, execution, candidate: p.review_status === 'unreviewed', foul: isFoul(possessionLength(p)) }
}

/** CSS classes for a segment or legend swatch. */
export function segmentClass(look: Partial<SegmentLook>): string {
  return [look.result, look.execution, look.foul && 'foul', look.candidate && 'candidate'].filter(Boolean).join(' ')
}

export const RESULT_LABEL: Record<ResultLook, string> = { goal: 'Goal', nogoal: 'No goal', noresult: 'No result', noshot: 'No shot' }
export const EXECUTION_LABEL: Record<ExecutionLook, string> = { proper: 'Proper', mis: 'Misexecuted', blank: 'Execution not tagged' }

/** Spoken form of a segment's look, e.g. "Goal, misexecuted, foul". */
export function lookLabel(look: SegmentLook): string {
  const parts = [RESULT_LABEL[look.result]]
  if (look.execution) parts.push(EXECUTION_LABEL[look.execution].toLowerCase())
  if (look.foul) parts.push('foul')
  if (look.candidate) parts.push('unreviewed candidate')
  return parts.join(', ')
}

export const FOUL_LABEL = `Foul (over ${FOUL_LIMIT_S} s)`

/** Hover text: number and tags (TAG-6). */
export function describe(p: Possession, n: number): string {
  const tags = [p.setup, p.shot_type, p.hole, p.shot_direction, p.result, p.execution].filter(Boolean).join(' · ')
  const len = possessionLength(p)
  const foul = isFoul(len) ? ` — foul, ${(len as number).toFixed(1)} s` : ''
  return `#${n}${tags ? ` ${tags}` : ' (no tags)'}${foul}${p.review_status === 'unreviewed' ? ' — unreviewed' : ''}`
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
    hole: d.hole,
    shot_direction: d.shot_direction,
    result: d.result,
    execution: d.execution,
    source: 'manual',
    confidence: null,
    review_status: 'confirmed',
    created_at: input.now,
    updated_at: input.now,
  }
}
