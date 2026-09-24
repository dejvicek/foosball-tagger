// Tagging keys (TAG-1). Player keys live in src/player/keys.ts.
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

export const TAG_GROUPS: TagGroup[] = [
  {
    field: 'setup',
    label: 'Setup',
    options: [
      { key: 'Z', value: 'Pull side', label: 'Pull side' },
      { key: 'X', value: 'Middle', label: 'Middle' },
      { key: 'C', value: 'Push side', label: 'Push side' },
    ],
  },
  {
    field: 'shot_type',
    label: 'Shot type',
    options: [
      { key: '1', value: 'Pin', label: 'Pin' },
      { key: '2', value: 'Pull', label: 'Pull' },
      { key: '3', value: 'Other', label: 'Other' },
    ],
  },
  {
    field: 'direction',
    label: 'Direction',
    options: [
      { key: 'Q', value: 'Pull', label: 'Pull' },
      { key: 'W', value: 'Push', label: 'Push' },
      { key: 'E', value: 'Straight', label: 'Straight' },
    ],
  },
  {
    field: 'hole',
    label: 'Hole',
    options: [
      { key: 'A', value: 'Pull-side lane', label: 'Pull-side' },
      { key: 'M', value: 'Middle lane', label: 'Middle' },
      { key: 'D', value: 'Push-side lane', label: 'Push-side' },
    ],
  },
  {
    field: 'result',
    label: 'Result',
    options: [
      { key: 'G', value: 'Goal', label: 'Goal' },
      { key: 'H', value: 'No goal', label: 'No goal', negative: true },
    ],
  },
  {
    field: 'execution',
    label: 'Execution',
    options: [
      { key: 'J', value: 'Proper', label: 'Proper' },
      { key: 'K', value: 'Misexecuted', label: 'Misexecuted', negative: true },
    ],
  },
]

export type TagAction = DraftEvent | { kind: 'undo' }

const BY_KEY = new Map<string, TagAction>()
for (const g of TAG_GROUPS) {
  for (const o of g.options) BY_KEY.set(o.key.toLowerCase(), { kind: 'tag', field: g.field, value: o.value } as DraftEvent)
}
BY_KEY.set('s', { kind: 'ballSet' })
BY_KEY.set('f', { kind: 'shot' })
BY_KEY.set('n', { kind: 'noShot' })
BY_KEY.set('u', { kind: 'undo' })
BY_KEY.set('enter', { kind: 'save' })
BY_KEY.set('escape', { kind: 'clear' })

/** The tagging action for a key, or null. Letters work in either case. */
export function tagAction(key: string): TagAction | null {
  return BY_KEY.get(key.toLowerCase()) ?? null
}
