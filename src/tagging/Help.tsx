import { KeyboardMap } from './KeyboardMap'
import type { Side } from '../data/types'

/** Tag definitions (PRD §2) and the keys (TAG-8). */
export function Help({ side }: { side: Side }) {
  return (
    <details className="card help">
      <summary>How to tag</summary>
      <div className="help-body">
        <KeyboardMap side={side} />
        <h3>Definitions</h3>
        <dl>
          <dt>Possession</dt>
          <dd>The ball is on your 3-bar, ending with a shot or a loss of the ball.</dd>
          <dt>Shot type</dt>
          <dd>Shot family: Pin, Pull, Other, or No shot.</dd>
          <dt>Setup</dt>
          <dd>Where the ball sits when the possession starts: Pull side, Middle, Push side. Resets to Middle after each save. Like the holes, A S D run the other way when you stand on the right.</dd>
          <dt>Hole</dt>
          <dd>Where the ball crossed or was aimed at, seen from the shooter: Pull long, Pull short, Middle, Push short, Push long. Keys 1–5 follow the goal as it looks in the video, so they run the other way when you stand on the right.</dd>
          <dt>Movement</dt>
          <dd>
            Not tagged: worked out from setup and hole and shown under Hole. Straight when the hole is on the setup’s
            side (a pull-side setup into Pull long or Pull short), otherwise Pull or Push.
          </dd>
          <dt>Shot direction</dt>
          <dd>Path of the shot: Straight or Z. Starts at Straight; C flips it.</dd>
          <dt>Execution</dt>
          <dd>Proper or Misexecuted, judged against the criteria you set for yourself before tagging.</dd>
        </dl>
        <p>
          To fix a saved possession, click its row in the log or its segment on the timeline: it opens in the tag panel, where the same keys
          change it, R and F move its start and shot to the current time, Enter saves the changes and Esc cancels.
        </p>
        <p>Blank fields stay blank and never count as misses. Keys do nothing while you type in a field; press Esc to leave it.</p>
      </div>
    </details>
  )
}
