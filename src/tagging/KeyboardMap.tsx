import { KEY } from './keyLabels'
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

/** The left-hand grid, as on the keyboard (ADR-0026). */
const ROWS: { name: string; caps: Cap[] }[] = [
  { name: 'Hole', caps: [f('Digit1', 'Pull long'), f('Digit2', 'Pull short'), f('Digit3', 'Middle'), f('Digit4', 'Push short'), f('Digit5', 'Push long')] },
  { name: 'Shot type', caps: [f('KeyQ', 'Pin'), f('KeyW', 'Pull'), f('KeyE', 'Other'), m('KeyR', 'Ball set')] },
  { name: 'Setup', caps: [f('KeyA', 'Pull side'), f('KeyS', 'Middle'), f('KeyD', 'Push side'), m('KeyF', 'Shot'), v('KeyG', 'Goal')] },
  { name: 'Execution · shot dir.', caps: [f('KeyZ', 'Proper'), f('KeyX', 'Misexecuted'), f('KeyC', 'Straight ⇄ Z/7'), m('KeyV', 'No shot'), v('KeyB', 'No goal')] },
]

const right = (): [string, string][] => [
  [['KeyJ', 'KeyK', 'KeyL'].map(keyLabel).join('  '), 'back 1 s · play/pause · forward 1 s (Shift: 5 s)'],
  [['KeyU', 'KeyO'].map(keyLabel).join('  '), 'about one frame back · forward'],
  [['BracketLeft', 'BracketRight'].map(keyLabel).join('  '), 'slower · faster'],
]

/** Keyboard map for the help (TAG-8). */
export function KeyboardMap() {
  useKeyboardLayout()
  return (
    <div className="keymap">
      <p className="keymap-lead">
        Keys go by position, so they sit in the same place on any keyboard layout; the labels show your keyboard.
        Left hand tags; each row is one field, and pull → push options run <b>left to right</b>. The index finger marks
        the moments, G and B the result.
      </p>
      <div className="keymap-grid" role="table" aria-label="Left-hand tagging keys">
        {ROWS.map((row, i) => (
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
        <kbd>{KEY.save}</kbd> save · <kbd>{KEY.clear}</kbd> or <kbd>Esc</kbd> clear the draft · <kbd>{KEY.undo}</kbd> undo the last save · <kbd>Space</kbd> play/pause ·
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
