import { KEY } from './keyLabels'
import { tagGroups } from './keymap'
import type { Side } from '../data/types'
import { keyLabel } from '../player/keyboardLayout'
import { useKeyboardLayout } from '../player/useKeyboardLayout'

type Kind = 'field' | 'moment' | 'verdict'
interface Cap {
  /** Physical key (KeyboardEvent.code). */
  k: string
  label: string
  kind: Kind
}

const f = (k: string, label: string): Cap => ({ k, label, kind: 'field' })
const m = (k: string, label: string): Cap => ({ k, label, kind: 'moment' })
const v = (k: string, label: string): Cap => ({ k, label, kind: 'verdict' })

const options = (side: Side, field: 'hole' | 'setup') => tagGroups(side).find((g) => g.field === field)?.options ?? []

/** The left-hand grid, as on the keyboard (ADR-0026); the hole and setup rows follow my side (ADR-0031, ADR-0033). */
const rows = (side: Side): { name: string; caps: Cap[] }[] => [
  { name: 'Hole', caps: options(side, 'hole').map((o) => f(o.code, o.value)) },
  { name: 'Shot type', caps: [f('KeyQ', 'Pin'), f('KeyW', 'Pull'), f('KeyE', 'Other'), m('KeyR', 'Ball set')] },
  { name: 'Setup', caps: [...options(side, 'setup').map((o) => f(o.code, o.value)), m('KeyF', 'Shot'), v('KeyG', 'Goal')] },
  { name: 'Execution · shot dir.', caps: [f('KeyZ', 'Proper'), f('KeyX', 'Misexecuted'), f('KeyC', 'Straight ⇄ Z'), m('KeyV', 'No shot'), v('KeyB', 'No goal')] },
]

const right = (): [string, string][] => [
  [['KeyJ', 'KeyK', 'KeyL'].map(keyLabel).join('  '), 'back 1 s · play/pause · forward 1 s (Shift: 5 s)'],
  [['KeyU', 'KeyO'].map(keyLabel).join('  '), 'about one frame back · forward'],
  [['BracketLeft', 'BracketRight'].map(keyLabel).join('  '), 'slower · faster'],
]

/** Keyboard map for the help (TAG-8). */
export function KeyboardMap({ side }: { side: Side }) {
  useKeyboardLayout()
  return (
    <div className="keymap">
      <p className="keymap-lead">
        Keys go by position, so they sit in the same place on any keyboard layout; the labels show your keyboard.
        Left hand tags; each row is one field, and pull → push options run <b>left to right</b>
        {side === 'right' ? <>, except hole and setup: standing on the right, the table is upside down in the video, so they run <b>push → pull</b></> : null}. The index
        finger marks the moments, G and B the result.
      </p>
      <div className="keymap-grid" role="table" aria-label="Left-hand tagging keys">
        {rows(side).map((row, i) => (
          <div className="keymap-row" role="row" key={row.name} style={{ marginLeft: `${i * 14}px` }}>
            <span className="keymap-name" role="rowheader">
              {row.name}
            </span>
            {row.caps.map((c) => (
              <span key={c.k} className={`keycap ${c.kind}`} role="cell">
                <kbd>{keyLabel(c.k)}</kbd>
                <span>{c.label}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="keymap-foot">
        <kbd>{KEY.save}</kbd> save · <kbd>{KEY.clear}</kbd> or <kbd>Esc</kbd> clear the draft · <kbd>Space</kbd> play/pause ·
        pressing a key again clears that field · {KEY.ballSet} after a shot saves it and starts the next possession.
      </p>
      <h4>Right hand (optional)</h4>
      <dl className="keymap-right">
        {right().map(([k, d]) => (
          <div key={k}>
            <dt>
              <kbd>{k}</kbd>
            </dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">Arrows (Shift for 5 s) and , . also move and step. Frame steps are approximate: YouTube cannot step exact frames.</p>
    </div>
  )
}
