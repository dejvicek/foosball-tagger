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
          <dt>Setup</dt>
          <dd>Where the ball sits when the possession starts: Middle, Pull side, Push side. Resets to Middle after each save.</dd>
          <dt>Shot type</dt>
          <dd>Shot family: Pin, Pull, Other, or No shot.</dd>
          <dt>Direction</dt>
          <dd>Lateral movement of the ball from the setup before the shot: Pull, Straight, Push.</dd>
          <dt>Hole</dt>
          <dd>Lane of the goal the ball crossed or was aimed at, seen from the shooter: Pull-side, Middle, Push-side lane.</dd>
          <dt>Execution</dt>
          <dd>Proper or Misexecuted, judged against the criteria you set for yourself before tagging.</dd>
        </dl>
        <p>Blank fields stay blank and never count as misses. Keys do nothing while you type in a field; press Esc to leave it.</p>
      </div>
    </details>
  )
}
