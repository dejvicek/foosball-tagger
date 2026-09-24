// Tagging keys (ADR-0021, replaces the PRD TAG-1 table). Everything is on the left
// hand, so the right hand can stay on the mouse or on the player keys:
//
//   1 2 3  Setup      pull side · middle · push side  │ 4 Save      │ 5 Proper
//   Q W E  Direction  pull · straight · push          │ R Ball set  │ T Misexecuted
//   A S D  Hole       pull-side · middle · push-side  │ F Shot      │ G Goal
//   Z X C  Shot type  Pin · Pull · Other              │ V No shot   │ B No goal
//
// Columns 1–3 always run pull → middle → push. Keys are physical positions
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
  options: TagOption[]
}

/** In keyboard-row order, so the panel reads like the keyboard. */
export const TAG_GROUPS: TagGroup[] = [
  {
    field: 'setup',
    label: 'Setup',
    options: [
      { code: 'Digit1', value: 'Pull side', label: 'Pull side' },
      { code: 'Digit2', value: 'Middle', label: 'Middle' },
      { code: 'Digit3', value: 'Push side', label: 'Push side' },
    ],
  },
  {
    field: 'direction',
    label: 'Direction',
    options: [
      { code: 'KeyQ', value: 'Pull', label: 'Pull' },
      { code: 'KeyW', value: 'Straight', label: 'Straight' },
      { code: 'KeyE', value: 'Push', label: 'Push' },
    ],
  },
  {
    field: 'hole',
    label: 'Hole',
    options: [
      { code: 'KeyA', value: 'Pull-side lane', label: 'Pull-side' },
      { code: 'KeyS', value: 'Middle lane', label: 'Middle' },
      { code: 'KeyD', value: 'Push-side lane', label: 'Push-side' },
    ],
  },
  {
    field: 'shot_type',
    label: 'Shot type',
    options: [
      { code: 'KeyZ', value: 'Pin', label: 'Pin' },
      { code: 'KeyX', value: 'Pull', label: 'Pull' },
      { code: 'KeyC', value: 'Other', label: 'Other' },
    ],
  },
  {
    field: 'execution',
    label: 'Execution',
    options: [
      { code: 'Digit5', value: 'Proper', label: 'Proper' },
      { code: 'KeyT', value: 'Misexecuted', label: 'Misexecuted', negative: true },
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
export const ACTION_CODE = { ballSet: 'KeyR', shot: 'KeyF', noShot: 'KeyV', save: 'Digit4' } as const

export type TagAction = DraftEvent | { kind: 'undo' }

const BY_CODE = new Map<string, TagAction>()
for (const g of TAG_GROUPS) {
  for (const o of g.options) BY_CODE.set(o.code, { kind: 'tag', field: g.field, value: o.value } as DraftEvent)
}
BY_CODE.set(ACTION_CODE.ballSet, { kind: 'ballSet' })
BY_CODE.set(ACTION_CODE.shot, { kind: 'shot' })
BY_CODE.set(ACTION_CODE.noShot, { kind: 'noShot' })
BY_CODE.set(ACTION_CODE.save, { kind: 'save' })

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
      return { kind: 'save' } // right hand
    case 'Escape':
      return { kind: 'clear' }
    case 'Backspace':
      return { kind: 'undo' } // right hand
  }
  return BY_CODE.get(codeOf(press)) ?? null
}
