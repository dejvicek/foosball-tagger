import { KeyboardMap } from './KeyboardMap'

/** Tag definitions (PRD §2) and the keys (TAG-8). */
export function Help() {
  return (
    <details className="card help">
      <summary>How to tag</summary>
      <div className="help-body">
        <KeyboardMap />
        <h3>Definitions</h3>
        <dl>
          <dt>Possession</dt>
          <dd>The ball is on your 3-bar, ending with a shot or a loss of the ball.</dd>
          <dt>Shot type</dt>
          <dd>Shot family: Pin, Pull, Other, or No shot.</dd>
          <dt>Setup</dt>
          <dd>Where the ball sits when the possession starts: Pull side, Middle, Push side. Resets to Middle after each save.</dd>
          <dt>Hole</dt>
          <dd>Where the ball crossed or was aimed at, seen from the shooter: Pull long, Pull short, Middle, Push short, Push long.</dd>
          <dt>Direction</dt>
          <dd>
            Not tagged: the statistics work it out from setup and hole. Straight when the hole is on the setup’s side
            (a pull-side setup into Pull long or Pull short), otherwise Pull or Push.
          </dd>
          <dt>Execution</dt>
          <dd>Proper or Misexecuted, judged against the criteria you set for yourself before tagging.</dd>
        </dl>
        <p>Blank fields stay blank and never count as misses. Keys do nothing while you type in a field; press Esc to leave it.</p>
      </div>
    </details>
  )
}
