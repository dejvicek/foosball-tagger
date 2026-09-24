import { KEY } from './keyLabels'

type Kind = 'field' | 'moment' | 'verdict'
interface Cap {
  k: string
  label: string
  kind: Kind
}

const f = (k: string, label: string): Cap => ({ k, label, kind: 'field' })
const m = (k: string, label: string): Cap => ({ k, label, kind: 'moment' })
const v = (k: string, label: string): Cap => ({ k, label, kind: 'verdict' })

/** The left-hand grid, as on the keyboard (ADR-0021). */
const ROWS: { name: string; caps: Cap[] }[] = [
  { name: 'Setup', caps: [f('1', 'Pull side'), f('2', 'Middle'), f('3', 'Push side'), m('4', 'Save'), v('5', 'Proper')] },
  { name: 'Direction', caps: [f('Q', 'Pull'), f('W', 'Straight'), f('E', 'Push'), m('R', 'Ball set'), v('T', 'Misexecuted')] },
  { name: 'Hole', caps: [f('A', 'Pull-side'), f('S', 'Middle'), f('D', 'Push-side'), m('F', 'Shot'), v('G', 'Goal')] },
  { name: 'Shot type', caps: [f('Z', 'Pin'), f('X', 'Pull'), f('C', 'Other'), m('V', 'No shot'), v('B', 'No goal')] },
]

const RIGHT: [string, string][] = [
  ['J  K  L', 'back 1 s · play/pause · forward 1 s (Shift: 5 s)'],
  ['U  O', 'about one frame back · forward'],
  ['[  ]', 'slower · faster'],
  ['Enter', 'save'],
  ['⌫', 'undo'],
]

/** Keyboard map for the help (TAG-8). */
export function KeyboardMap() {
  return (
    <div className="keymap">
      <p className="keymap-lead">
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
                <kbd>{c.k}</kbd>
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
        {RIGHT.map(([k, d]) => (
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
