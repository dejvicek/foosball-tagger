// Tag panel state machine (TAG-1..5). Pure: the screen feeds it events with the
// current player time and persists what it returns.
import type { Execution, Hole, Result, Setup, ShotDirection, ShotType } from '../data/types'
import { formatTime } from '../player/time'
import { KEY } from './keyLabels'

export interface Draft {
  start_s: number | null
  shot_s: number | null
  setup: Setup | null
  shot_type: ShotType | null
  hole: Hole | null
  shot_direction: ShotDirection | null
  result: Result | null
  execution: Execution | null
}

export type TagField = 'setup' | 'shot_type' | 'hole' | 'shot_direction' | 'result' | 'execution'
type TagValue<F extends TagField> = NonNullable<Draft[F]>

/** A new draft; Setup starts at Middle (TAG-2), Shot type at Pin (ADR-0027), Shot direction at Straight (ADR-0028). */
export function emptyDraft(): Draft {
  return { start_s: null, shot_s: null, setup: 'Middle', shot_type: 'Pin', hole: null, shot_direction: 'Straight', result: null, execution: null }
}

export type DraftEvent =
  | { kind: 'ballSet' }
  | { kind: 'shot' }
  | { kind: 'noShot' }
  | { kind: 'save' }
  | { kind: 'clear' }
  /** Straight ⇄ Z (ADR-0028); from blank, Z. */
  | { kind: 'toggleShotDirection' }
  | { [F in TagField]: { kind: 'tag'; field: F; value: TagValue<F> } }[TagField]

export interface DraftContext {
  /** Current player time. */
  t: number
  /** The game's time range (TAG-5). */
  range: { start: number; end: number }
  /** e.g. "Game 2", for messages. */
  gameLabel: string
}

export interface Outcome {
  draft: Draft
  /** A possession to save, if this event completed one. */
  save?: Draft
  message?: string
  /** Set when the event was refused; `draft` is then unchanged. */
  error?: string
}

/** Tolerance for "inside the game" so a press right at a boundary counts. */
const EDGE = 0.05

/** Whether the draft holds anything worth saving (the defaults alone are not). */
export function hasContent(d: Draft): boolean {
  const e = emptyDraft()
  return d.start_s != null || d.shot_s != null || d.shot_type !== e.shot_type || d.hole != null || d.shot_direction !== e.shot_direction || d.result != null || d.execution != null
}

/** A No-shot possession: every tag blank except the shot type (ADR-0037). */
function asNoShot(d: Draft): Draft {
  return { ...d, setup: null, shot_type: 'No shot', hole: null, shot_direction: null, result: null, execution: null }
}

/** Back from No shot to a shot: the tags start at a new draft's defaults (ADR-0037). */
function asShot(d: Draft): Draft {
  if (d.shot_type !== 'No shot') return d
  const { setup, shot_type, hole, shot_direction, result, execution } = emptyDraft()
  return { ...d, setup, shot_type, hole, shot_direction, result, execution }
}

/**
 * What still blocks saving (ADR-0037): both times, and for a shot every tag. A No-shot
 * possession needs only its times.
 */
export function missing(d: Draft): string[] {
  const out: string[] = []
  if (d.start_s == null) out.push('start')
  if (d.shot_s == null) out.push(d.shot_type === 'No shot' ? 'end' : 'shot')
  if (d.shot_type !== 'No shot') out.push(...FIELDS.filter((f) => d[f] == null).map((f) => FIELD_LABEL[f]))
  return out
}

export function isComplete(d: Draft): boolean {
  return missing(d).length === 0
}

function incomplete(d: Draft): string {
  return `Can’t save yet. Still blank: ${missing(d).join(', ')}.`
}

const noShotTags = () => `No shot has no tags. Press ${KEY.shot} to make it a shot.`

function outsideRange(ctx: DraftContext): string | null {
  const { t, range } = ctx
  if (t >= range.start - EDGE && t <= range.end + EDGE) return null
  const end = Number.isFinite(range.end) ? formatTime(range.end) : 'end of video'
  return `${formatTime(t)} is outside ${ctx.gameLabel} (${formatTime(range.start)}–${end}). If it belongs to this game, adjust the game’s start or end on the video screen.`
}

export function reduce(draft: Draft, event: DraftEvent, ctx: DraftContext): Outcome {
  const t = ctx.t
  switch (event.kind) {
    case 'ballSet': {
      const out = outsideRange(ctx)
      if (out) return { draft, error: out }
      // Ball set after a shot: save the tagged possession, then start the next one (TAG-1);
      // only once it is fully tagged (ADR-0037).
      if (draft.shot_s != null) {
        if (!isComplete(draft)) return { draft, error: incomplete(draft) }
        return { draft: { ...emptyDraft(), start_s: t }, save: draft, message: 'Saved the possession and started the next one.' }
      }
      // Ball set again before the shot moves the start; tags already set are kept (ADR-0019).
      return { draft: { ...draft, start_s: t } }
    }
    case 'shot': {
      const out = outsideRange(ctx)
      if (out) return { draft, error: out }
      if (draft.start_s != null && t < draft.start_s) {
        return {
          draft,
          error: `The shot (${formatTime(t)}) can’t be before the start (${formatTime(draft.start_s)}). Move forward, or press ${KEY.ballSet} at the new start.`,
        }
      }
      return { draft: { ...asShot(draft), shot_s: t } }
    }
    case 'noShot': {
      const out = outsideRange(ctx)
      if (out) return { draft, error: out }
      if (draft.start_s != null && t < draft.start_s) {
        return { draft, error: `This time (${formatTime(t)}) is before the start of the possession (${formatTime(draft.start_s)}).` }
      }
      if (draft.start_s == null) return { draft, error: `Press ${KEY.ballSet} when the ball is set first; a possession without a shot still needs its start.` }
      const saved = asNoShot({ ...draft, shot_s: t })
      return { draft: emptyDraft(), save: saved, message: 'Saved a possession without a shot.' }
    }
    case 'save': {
      if (!hasContent(draft)) return { draft, error: `Nothing to save yet. Press ${KEY.ballSet} when the ball is set and ${KEY.shot} at the shot.` }
      if (!isComplete(draft)) return { draft, error: incomplete(draft) }
      return { draft: emptyDraft(), save: draft, message: 'Saved the possession.' }
    }
    case 'clear':
      return { draft: emptyDraft(), ...(hasContent(draft) ? { message: 'Cleared the draft.' } : {}) }
    case 'toggleShotDirection':
    case 'tag':
      return applyTag(draft, event)
  }
}

function applyTag(draft: Draft, event: Extract<DraftEvent, { kind: 'tag' | 'toggleShotDirection' }>): { draft: Draft; error?: string } {
  // No shot keeps every tag blank; F turns it back into a shot (ADR-0037).
  if (draft.shot_type === 'No shot') return { draft, error: noShotTags() }
  if (event.kind === 'toggleShotDirection') return { draft: { ...draft, shot_direction: draft.shot_direction === 'Z' ? 'Straight' : 'Z' } }
  // Pressing a tag key a second time clears that field (TAG-1).
  return { draft: { ...draft, [event.field]: draft[event.field] === event.value ? null : event.value } }
}

export interface EditOutcome {
  draft: Draft
  /** The edited values to write to the possession. */
  save?: Draft
  /** Leave edit mode without saving. */
  cancel?: true
  /** Set when the event was refused; `draft` is then unchanged. */
  error?: string
}

/**
 * Editing a saved possession in the panel (ADR-0030). Tag keys change its fields as
 * for a draft; Ball set and Shot move its start and shot to the current time; No shot
 * marks it without a shot; Enter saves the changes, Esc / Backspace cancels.
 */
export function reduceEdit(draft: Draft, event: DraftEvent, ctx: DraftContext): EditOutcome {
  const t = ctx.t
  switch (event.kind) {
    case 'ballSet': {
      const out = outsideRange(ctx)
      if (out) return { draft, error: out }
      if (draft.shot_s != null && t > draft.shot_s) return { draft, error: `The start (${formatTime(t)}) can’t be after the shot (${formatTime(draft.shot_s)}).` }
      return { draft: { ...draft, start_s: t } }
    }
    case 'shot': {
      const out = outsideRange(ctx)
      if (out) return { draft, error: out }
      if (draft.start_s != null && t < draft.start_s) return { draft, error: `The shot (${formatTime(t)}) can’t be before the start (${formatTime(draft.start_s)}).` }
      return { draft: { ...asShot(draft), shot_s: t } }
    }
    case 'noShot':
      return { draft: asNoShot(draft) }
    case 'save':
      return isComplete(draft) ? { draft, save: draft } : { draft, error: incomplete(draft) }
    case 'clear':
      return { draft, cancel: true }
    case 'toggleShotDirection':
    case 'tag':
      return applyTag(draft, event)
  }
}

/** A saved possession's values, to edit in the panel. */
export function toDraft(p: Draft): Draft {
  const { start_s, shot_s, setup, shot_type, hole, shot_direction, result, execution } = p
  return { start_s, shot_s, setup, shot_type, hole, shot_direction, result, execution }
}

/** Whether two drafts hold the same values. */
export function sameDraft(a: Draft, b: Draft): boolean {
  return (Object.keys(a) as (keyof Draft)[]).every((k) => a[k] === b[k])
}

const FIELD_LABEL: Record<TagField, string> = {
  setup: 'setup',
  shot_type: 'shot type',
  hole: 'hole',
  shot_direction: 'shot direction',
  result: 'result',
  execution: 'execution',
}
const FIELDS: TagField[] = ['shot_type', 'setup', 'hole', 'shot_direction', 'execution', 'result']

/** The next step, as shown under the timer (TAG-3). `editing` names the possession being edited (ADR-0030). */
export function statusText(d: Draft, editing?: string): string {
  const blank = missing(d)
  if (editing) {
    const head = `Editing ${editing}. ${KEY.ballSet} / ${KEY.shot} set its start / shot to the current time.`
    return blank.length > 0 ? `${head} Still blank: ${blank.join(', ')}. Esc cancels.` : `${head} ${KEY.save} saves the changes, Esc cancels.`
  }
  if (d.start_s == null && d.shot_s == null) return `Press ${KEY.ballSet} when the ball is set.`
  if (d.shot_s == null) return `Possession running. Press ${KEY.shot} at the shot, or ${KEY.noShot} if it ends without one.`
  return blank.length > 0
    ? `Tag the shot; saving unlocks once nothing is blank. Still blank: ${blank.join(', ')}.`
    : `All tagged. Press ${KEY.save} to save, or ${KEY.ballSet} to save and start the next possession.`
}
