// Tag panel state machine (TAG-1..5). Pure: the screen feeds it events with the
// current player time and persists what it returns.
import type { Direction, Execution, Hole, Result, Setup, ShotType } from '../data/types'
import { formatTime } from '../player/time'

export interface Draft {
  start_s: number | null
  shot_s: number | null
  setup: Setup | null
  shot_type: ShotType | null
  direction: Direction | null
  hole: Hole | null
  result: Result | null
  execution: Execution | null
}

export type TagField = 'setup' | 'shot_type' | 'direction' | 'hole' | 'result' | 'execution'
type TagValue<F extends TagField> = NonNullable<Draft[F]>

/** A new draft; Setup starts at Middle (TAG-2). */
export function emptyDraft(): Draft {
  return { start_s: null, shot_s: null, setup: 'Middle', shot_type: null, direction: null, hole: null, result: null, execution: null }
}

export type DraftEvent =
  | { kind: 'ballSet' }
  | { kind: 'shot' }
  | { kind: 'noShot' }
  | { kind: 'save' }
  | { kind: 'clear' }
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

/** Whether the draft holds anything worth saving (a default Setup alone is not). */
export function hasContent(d: Draft): boolean {
  return (
    d.start_s != null || d.shot_s != null || d.shot_type != null || d.direction != null || d.hole != null || d.result != null || d.execution != null
  )
}

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
      // S after F: save the tagged possession, then start the next one (TAG-1).
      if (draft.shot_s != null) {
        return { draft: { ...emptyDraft(), start_s: t }, save: draft, message: 'Saved the possession and started the next one.' }
      }
      // S again before F moves the start; tags already set are kept (ADR-0019).
      return { draft: { ...draft, start_s: t } }
    }
    case 'shot': {
      const out = outsideRange(ctx)
      if (out) return { draft, error: out }
      if (draft.start_s != null && t < draft.start_s) {
        return {
          draft,
          error: `The shot (${formatTime(t)}) can’t be before the start (${formatTime(draft.start_s)}). Move forward, or press S at the new start.`,
        }
      }
      return { draft: { ...draft, shot_s: t, shot_type: draft.shot_type === 'No shot' ? null : draft.shot_type } }
    }
    case 'noShot': {
      const out = outsideRange(ctx)
      if (out) return { draft, error: out }
      if (draft.start_s != null && t < draft.start_s) {
        return { draft, error: `This time (${formatTime(t)}) is before the start of the possession (${formatTime(draft.start_s)}).` }
      }
      const saved: Draft = { ...draft, shot_s: t, shot_type: 'No shot', direction: null, hole: null, result: null, execution: null }
      return { draft: emptyDraft(), save: saved, message: 'Saved a possession without a shot.' }
    }
    case 'save': {
      if (!hasContent(draft)) return { draft, error: 'Nothing to save yet. Press S when the ball is set and F at the shot.' }
      return { draft: emptyDraft(), save: draft, message: 'Saved the possession.' }
    }
    case 'clear':
      return { draft: emptyDraft(), ...(hasContent(draft) ? { message: 'Cleared the draft.' } : {}) }
    case 'tag': {
      // Pressing a tag key a second time clears that field (TAG-1).
      const current = draft[event.field]
      return { draft: { ...draft, [event.field]: current === event.value ? null : event.value } }
    }
  }
}

const FIELD_LABEL: Record<TagField, string> = {
  setup: 'setup',
  shot_type: 'shot type',
  direction: 'direction',
  hole: 'hole',
  result: 'result',
  execution: 'execution',
}
const FIELDS: TagField[] = ['setup', 'shot_type', 'direction', 'hole', 'result', 'execution']

/** The next step, as shown under the timer (TAG-3). */
export function statusText(d: Draft): string {
  if (d.start_s == null && d.shot_s == null) return 'Press S when the ball is set.'
  if (d.shot_s == null) return 'Possession running. Press F at the shot, or N if it ends without one.'
  const blank = FIELDS.filter((f) => d[f] == null).map((f) => FIELD_LABEL[f])
  return blank.length > 0
    ? `Tag the shot, then press Enter. Still blank: ${blank.join(', ')}.`
    : 'All tagged. Press Enter to save, or S to save and start the next possession.'
}
