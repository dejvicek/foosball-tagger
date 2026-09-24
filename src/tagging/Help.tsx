/** Tag definitions (PRD §2) and the key table (TAG-8). */
export function Help() {
  return (
    <details className="card help">
      <summary>How to tag</summary>
      <div className="help-body">
        <h3>Keys</h3>
        <dl>
          <dt>S</dt>
          <dd>Ball set: the possession starts. After a shot (F), S saves it and starts the next one.</dd>
          <dt>F</dt>
          <dd>Shot: the possession ends.</dd>
          <dt>N</dt>
          <dd>No shot (lost ball, pass, time): ends and saves the possession at once.</dd>
          <dt>Enter</dt>
          <dd>Save. Fields left blank stay blank and never count as failures.</dd>
          <dt>Esc</dt>
          <dd>Clear the draft.</dd>
          <dt>U</dt>
          <dd>Delete the last possession saved on this page.</dd>
          <dt>Z X C</dt>
          <dd>Setup: Pull side, Middle, Push side. Resets to Middle after each save.</dd>
          <dt>1 2 3</dt>
          <dd>Shot type: Pin, Pull, Other.</dd>
          <dt>Q W E</dt>
          <dd>Direction: Pull, Push, Straight.</dd>
          <dt>A M D</dt>
          <dd>Hole: Pull-side lane, Middle lane, Push-side lane.</dd>
          <dt>G H</dt>
          <dd>Result: Goal, No goal.</dd>
          <dt>J K</dt>
          <dd>Execution: Proper, Misexecuted.</dd>
          <dt>Space</dt>
          <dd>Play or pause.</dd>
          <dt>← →</dt>
          <dd>1 s back or forward; with Shift, 5 s.</dd>
          <dt>, .</dt>
          <dd>About one frame back or forward. Approximate: YouTube cannot step exact frames; the step is 1/fps of the video.</dd>
          <dt>[ ]</dt>
          <dd>Slower or faster: 0.25×, 0.5×, 0.75×, 1×, 1.5×, 2×.</dd>
        </dl>
        <p>Pressing a tag key a second time clears that field. Keys do nothing while you type in a field; press Esc to leave it.</p>
        <h3>Definitions</h3>
        <dl>
          <dt>Possession</dt>
          <dd>The ball is on your 3-bar, ending with a shot or a loss of the ball.</dd>
          <dt>Setup</dt>
          <dd>Where the ball sits when the possession starts: Middle, Pull side, Push side.</dd>
          <dt>Shot type</dt>
          <dd>Shot family: Pin, Pull, Other, or No shot.</dd>
          <dt>Direction</dt>
          <dd>Lateral movement of the ball from the setup before the shot: Pull, Push, Straight.</dd>
          <dt>Hole</dt>
          <dd>Lane of the goal the ball crossed or was aimed at, seen from the shooter: Pull-side, Middle, Push-side lane.</dd>
          <dt>Execution</dt>
          <dd>Proper or Misexecuted, judged against the criteria you set for yourself before tagging.</dd>
        </dl>
      </div>
    </details>
  )
}
