// Tagging keys (ADR-0026, replaces the grid of ADR-0021). Every field is on the left
// hand, so the right hand can stay on the mouse or on the player keys:
//
//   1 2 3 4 5  Hole       pull long · pull short · middle · push short · push long
//                         (holes and setup reversed when I stand on the right, so the
//                         keys match the table as it appears in the video, ADR-0031, ADR-0035)
//   Q W E      Shot type  Pin · Pull · Other          │ R Ball set │
//   A S D      Setup      pull side · middle · push   │ F Shot     │ G Goal
//   Z X        Execution  Proper · Misexecuted        │ V No shot  │ B No goal
//   C          Shot direction  Straight ⇄ Z (ADR-0028)
//
// Enter saves, Backspace / Esc clear the draft.
// The pull → push options run left to right. Keys are physical positions
// (KeyboardEvent.code), so the grid stays put on QWERTZ and other layouts; the
// labels shown come from src/player/keyboardLayout.ts (ADR-0022).
import { codeOf } from '../player/keyboardLayout'
import type { Side } from '../data/types'
import type { DraftEvent, TagField } from './draft'

export interface TagOption {
  /** Physical key, e.g. 'KeyZ' (labelled Y on a Czech keyboard). */
  code: string
  value: string
  /** Short label for buttons. */
  label: string
  /** Shown in red when selected (a miss). */
  negative?: boolean
}

export interface TagGroup {
  field: TagField
  label: string
  /** Every option shows this one key, which flips between them (Shot direction, ADR-0028). */
  toggle?: true
  options: TagOption[]
}

/** In tag panel order (ADR-0026), for a player on the left of the frame. */
const LEFT_GROUPS: TagGroup[] = [
  {
    field: 'shot_type',
    label: 'Shot type',
    options: [
      { code: 'KeyQ', value: 'Pin', label: 'Pin' },
      { code: 'KeyW', value: 'Pull', label: 'Pull' },
      { code: 'KeyE', value: 'Other', label: 'Other' },
    ],
  },
  {
    field: 'setup',
    label: 'Setup',
    options: [
      { code: 'KeyA', value: 'Pull side', label: 'Pull side' },
      { code: 'KeyS', value: 'Middle', label: 'Middle' },
      { code: 'KeyD', value: 'Push side', label: 'Push side' },
    ],
  },
  {
    field: 'hole',
    label: 'Hole',
    options: [
      { code: 'Digit1', value: 'Pull long', label: 'Pull long' },
      { code: 'Digit2', value: 'Pull short', label: 'Pull short' },
      { code: 'Digit3', value: 'Middle', label: 'Middle' },
      { code: 'Digit4', value: 'Push short', label: 'Push short' },
      { code: 'Digit5', value: 'Push long', label: 'Push long' },
    ],
  },
  {
    field: 'shot_direction',
    label: 'Shot direction',
    toggle: true,
    options: [
      { code: 'KeyC', value: 'Straight', label: 'Straight' },
      { code: 'KeyC', value: 'Z', label: 'Z' },
    ],
  },
  {
    field: 'execution',
    label: 'Execution',
    options: [
      { code: 'KeyZ', value: 'Proper', label: 'Proper' },
      { code: 'KeyX', value: 'Misexecuted', label: 'Misexecuted', negative: true },
    ],
  },
  {
    field: 'result',
    label: 'Result',
    options: [
      { code: 'KeyG', value: 'Goal', label: 'Goal' },
      { code: 'KeyB', value: 'No goal', label: 'No goal', negative: true },
    ],
  },
]

/** Fields laid out as on the table, which reads the other way round when I stand on the right. */
const MIRRORED: TagField[] = ['hole', 'setup']

/**
 * The groups for the side I stand on. On the right the table is upside down in the
 * video, so holes (1–5) and setup (A S D) run push → pull, on the keys and in the
 * panel (ADR-0031, ADR-0035).
 */
export function tagGroups(side: Side): TagGroup[] {
  if (side === 'left') return LEFT_GROUPS
  return LEFT_GROUPS.map((g) => {
    if (!MIRRORED.includes(g.field)) return g
    const codes = g.options.map((o) => o.code)
    return { ...g, options: [...g.options].reverse().map((o, i) => ({ ...o, code: codes[i] as string })) }
  })
}

/** Physical keys of the non-field actions. */
export const ACTION_CODE = { ballSet: 'KeyR', shot: 'KeyF', noShot: 'KeyV' } as const

export type TagAction = DraftEvent

function byCode(side: Side): Map<string, TagAction> {
  const map = new Map<string, TagAction>()
  for (const g of tagGroups(side)) {
    if (g.toggle) continue
    for (const o of g.options) map.set(o.code, { kind: 'tag', field: g.field, value: o.value } as DraftEvent)
  }
  map.set('KeyC', { kind: 'toggleShotDirection' })
  map.set(ACTION_CODE.ballSet, { kind: 'ballSet' })
  map.set(ACTION_CODE.shot, { kind: 'shot' })
  map.set(ACTION_CODE.noShot, { kind: 'noShot' })
  return map
}
const BY_CODE: Record<Side, Map<string, TagAction>> = { left: byCode('left'), right: byCode('right') }

export interface KeyPress {
  key: string
  code?: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
}

/**
 * The tagging action for a key press, or null. Plain keys match by position;
 * ⌘ / Ctrl chords are left to the browser (ADR-0034). `side` is the side of
 * the frame I stand on in this game (ADR-0031).
 */
export function tagAction(e: KeyPress | string, side: Side = 'left'): TagAction | null {
  const press = typeof e === 'string' ? { key: e } : e
  if (press.metaKey || press.ctrlKey) return null
  switch (press.key) {
    case 'Enter':
      return { kind: 'save' }
    case 'Escape':
    case 'Backspace':
      return { kind: 'clear' }
  }
  return BY_CODE[side].get(codeOf(press)) ?? null
}
