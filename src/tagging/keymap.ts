// Tagging keys (ADR-0026, replaces the grid of ADR-0021). Every field is on the left
// hand, so the right hand can stay on the mouse or on the player keys:
//
//   1 2 3 4 5  Hole       pull long · pull short · middle · push short · push long
//   Q W E      Shot type  Pin · Pull · Other          │ R Ball set │
//   A S D      Setup      pull side · middle · push   │ F Shot     │ G Goal
//   Z X        Execution  Proper · Misexecuted        │ V No shot  │ B No goal
//   C          Shot direction  Straight ⇄ Z/7 (ADR-0028)
//
// Enter saves, Backspace / Esc clear the draft, ⌘Z / Ctrl+Z undoes the last save.
// The pull → push options run left to right. Keys are physical positions
// (KeyboardEvent.code), so the grid stays put on QWERTZ and other layouts; the
// labels shown come from src/player/keyboardLayout.ts (ADR-0022).
import { codeOf } from '../player/keyboardLayout'
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

/** In tag panel order (ADR-0026). */
export const TAG_GROUPS: TagGroup[] = [
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
      { code: 'KeyC', value: 'Z/7', label: 'Z/7' },
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

/** Physical keys of the non-field actions. */
export const ACTION_CODE = { ballSet: 'KeyR', shot: 'KeyF', noShot: 'KeyV' } as const

export type TagAction = DraftEvent | { kind: 'undo' }

const BY_CODE = new Map<string, TagAction>()
for (const g of TAG_GROUPS) {
  if (g.toggle) continue
  for (const o of g.options) BY_CODE.set(o.code, { kind: 'tag', field: g.field, value: o.value } as DraftEvent)
}
BY_CODE.set('KeyC', { kind: 'toggleShotDirection' })
BY_CODE.set(ACTION_CODE.ballSet, { kind: 'ballSet' })
BY_CODE.set(ACTION_CODE.shot, { kind: 'shot' })
BY_CODE.set(ACTION_CODE.noShot, { kind: 'noShot' })

export interface KeyPress {
  key: string
  code?: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
}

/**
 * The tagging action for a key press, or null. Plain keys match by position;
 * ⌘Z / Ctrl+Z match the letter Z, like every other app's undo.
 */
export function tagAction(e: KeyPress | string): TagAction | null {
  const press = typeof e === 'string' ? { key: e } : e
  if (press.metaKey || press.ctrlKey) return press.key.toLowerCase() === 'z' && !press.shiftKey ? { kind: 'undo' } : null
  switch (press.key) {
    case 'Enter':
      return { kind: 'save' }
    case 'Escape':
    case 'Backspace':
      return { kind: 'clear' }
  }
  return BY_CODE.get(codeOf(press)) ?? null
}
