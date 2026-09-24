// Tagging keys (ADR-0021, replaces the PRD TAG-1 table). Everything is on the left
// hand, so the right hand can stay on the mouse or on the player keys:
//
//   1 2 3  Setup      pull side · middle · push side  │ 4 Save      │ 5 Proper
//   Q W E  Direction  pull · straight · push          │ R Ball set  │ T Misexecuted
//   A S D  Hole       pull-side · middle · push-side  │ F Shot      │ G Goal
//   Z X C  Shot type  Pin · Pull · Other              │ V No shot   │ B No goal
//
// Columns 1–3 always run pull → middle → push. Player keys live in src/player/keys.ts.
import type { DraftEvent, TagField } from './draft'

export interface TagOption {
  key: string
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
      { key: '1', value: 'Pull side', label: 'Pull side' },
      { key: '2', value: 'Middle', label: 'Middle' },
      { key: '3', value: 'Push side', label: 'Push side' },
    ],
  },
  {
    field: 'direction',
    label: 'Direction',
    options: [
      { key: 'Q', value: 'Pull', label: 'Pull' },
      { key: 'W', value: 'Straight', label: 'Straight' },
      { key: 'E', value: 'Push', label: 'Push' },
    ],
  },
  {
    field: 'hole',
    label: 'Hole',
    options: [
      { key: 'A', value: 'Pull-side lane', label: 'Pull-side' },
      { key: 'S', value: 'Middle lane', label: 'Middle' },
      { key: 'D', value: 'Push-side lane', label: 'Push-side' },
    ],
  },
  {
    field: 'shot_type',
    label: 'Shot type',
    options: [
      { key: 'Z', value: 'Pin', label: 'Pin' },
      { key: 'X', value: 'Pull', label: 'Pull' },
      { key: 'C', value: 'Other', label: 'Other' },
    ],
  },
  {
    field: 'execution',
    label: 'Execution',
    options: [
      { key: '5', value: 'Proper', label: 'Proper' },
      { key: 'T', value: 'Misexecuted', label: 'Misexecuted', negative: true },
    ],
  },
  {
    field: 'result',
    label: 'Result',
    options: [
      { key: 'G', value: 'Goal', label: 'Goal' },
      { key: 'B', value: 'No goal', label: 'No goal', negative: true },
    ],
  },
]

export type TagAction = DraftEvent | { kind: 'undo' }

const BY_KEY = new Map<string, TagAction>()
for (const g of TAG_GROUPS) {
  for (const o of g.options) BY_KEY.set(o.key.toLowerCase(), { kind: 'tag', field: g.field, value: o.value } as DraftEvent)
}
BY_KEY.set('r', { kind: 'ballSet' })
BY_KEY.set('f', { kind: 'shot' })
BY_KEY.set('v', { kind: 'noShot' })
BY_KEY.set('4', { kind: 'save' })
BY_KEY.set('enter', { kind: 'save' }) // right hand
BY_KEY.set('escape', { kind: 'clear' })
BY_KEY.set('backspace', { kind: 'undo' }) // right hand

export interface KeyPress {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
}

/** The tagging action for a key press, or null. Letters work in either case; ⌘Z / Ctrl+Z undo. */
export function tagAction(e: KeyPress | string): TagAction | null {
  const press = typeof e === 'string' ? { key: e } : e
  const k = press.key.toLowerCase()
  if (press.metaKey || press.ctrlKey) return k === 'z' && !press.shiftKey ? { kind: 'undo' } : null
  return BY_KEY.get(k) ?? null
}
