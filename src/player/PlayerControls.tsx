import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { PlayerController } from './controller'
import { formatTime } from './time'

function usePlayerSnapshot(controller: PlayerController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot)
}

/** Current time, updated every animation frame without re-rendering React (PRD §4.4). */
export function PlayerTime({ controller }: { controller: PlayerController }) {
  const ref = useRef<HTMLSpanElement>(null)
  const { duration } = usePlayerSnapshot(controller)

  useEffect(() => {
    let frame = 0
    let last = ''
    const tick = () => {
      const text = formatTime(controller.time())
      if (text !== last && ref.current) {
        ref.current.textContent = text
        last = text
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [controller])

  return (
    <span className="time" aria-label="Current time">
      <span ref={ref}>{formatTime(0)}</span> / {formatTime(duration)}
    </span>
  )
}

/** The app's own transport controls; buttons never take focus (TAG-1). */
export function PlayerControls({ controller, fps }: { controller: PlayerController; fps: number }) {
  const { ready, playing, rate, speeds } = usePlayerSnapshot(controller)

  return (
    <div className="ctl" role="toolbar" aria-label="Player controls">
      <button className="btn nf play" type="button" disabled={!ready} onClick={() => controller.toggle()}>
        {playing ? 'Pause' : 'Play'} <kbd>Space</kbd>
      </button>
      <button className="btn nf" type="button" disabled={!ready} onClick={() => controller.nudge(-5)} title="Back 5 s (Shift+← or Shift+J)">
        −5 s
      </button>
      <button className="btn nf" type="button" disabled={!ready} onClick={() => controller.nudge(-1)} title="Back 1 s (← or J)">
        −1 s
      </button>
      <button
        className="btn nf"
        type="button"
        disabled={!ready}
        onClick={() => controller.frameStep(-1, fps)}
        title="About one frame back (U or ,)"
        aria-label="About one frame back"
      >
        ‹ Frame
      </button>
      <button
        className="btn nf"
        type="button"
        disabled={!ready}
        onClick={() => controller.frameStep(1, fps)}
        title="About one frame forward (O or .)"
        aria-label="About one frame forward"
      >
        Frame ›
      </button>
      <button className="btn nf" type="button" disabled={!ready} onClick={() => controller.nudge(1)} title="Forward 1 s (→ or L)">
        +1 s
      </button>
      <button className="btn nf" type="button" disabled={!ready} onClick={() => controller.nudge(5)} title="Forward 5 s (Shift+→ or Shift+L)">
        +5 s
      </button>
      <select
        aria-label="Playback speed"
        title="Speed ([ and ])"
        disabled={!ready}
        value={String(rate)}
        onChange={(e) => {
          controller.setRate(Number(e.target.value))
          e.target.blur()
        }}
      >
        {!speeds.includes(rate) && <option value={String(rate)}>{rate}×</option>}
        {speeds.map((s) => (
          <option key={s} value={String(s)}>
            {s}×
          </option>
        ))}
      </select>
      <PlayerTime controller={controller} />
    </div>
  )
}
