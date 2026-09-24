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

/** The left-hand grid, as on the keyboard (ADR-0021). */
const ROWS: { name: string; caps: Cap[] }[] = [
  { name: 'Setup', caps: [f('Digit1', 'Pull side'), f('Digit2', 'Middle'), f('Digit3', 'Push side'), m('Digit4', 'Save'), v('Digit5', 'Proper')] },
  { name: 'Direction', caps: [f('KeyQ', 'Pull'), f('KeyW', 'Straight'), f('KeyE', 'Push'), m('KeyR', 'Ball set'), v('KeyT', 'Misexecuted')] },
  { name: 'Hole', caps: [f('KeyA', 'Pull-side'), f('KeyS', 'Middle'), f('KeyD', 'Push-side'), m('KeyF', 'Shot'), v('KeyG', 'Goal')] },
  { name: 'Shot type', caps: [f('KeyZ', 'Pin'), f('KeyX', 'Pull'), f('KeyC', 'Other'), m('KeyV', 'No shot'), v('KeyB', 'No goal')] },
]

const right = (): [string, string][] => [
  [['KeyJ', 'KeyK', 'KeyL'].map(keyLabel).join('  '), 'back 1 s · play/pause · forward 1 s (Shift: 5 s)'],
  [['KeyU', 'KeyO'].map(keyLabel).join('  '), 'about one frame back · forward'],
  [['BracketLeft', 'BracketRight'].map(keyLabel).join('  '), 'slower · faster'],
  ['Enter', 'save'],
  ['⌫', 'undo'],
]

/** Keyboard map for the help (TAG-8). */
export function KeyboardMap() {
  useKeyboardLayout()
  return (
    <div className="keymap">
      <p className="keymap-lead">
        Keys go by position, so they sit in the same place on any keyboard layout; the labels show your keyboard.
        Left hand tags; each row is one field. The first three columns always run <b>pull → middle → push</b>. The index
        finger marks the moments, the stretch column the verdicts.
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
        <kbd>Space</kbd> play/pause · <kbd>{KEY.clear}</kbd> clear the draft · <kbd>{KEY.undo}</kbd> undo the last save ·
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
