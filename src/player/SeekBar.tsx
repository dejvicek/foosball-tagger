import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import type { PlayerController } from './controller'
import { percentAt } from './scrub'
import { formatTime } from './time'
import { useScrubber } from './useScrubber'

export interface SeekMark {
  id: string
  start: number
  end: number
  label: string
}

interface Props {
  controller: PlayerController
  /** Ranges to show on the bar (games). */
  marks?: SeekMark[]
}

/**
 * Seek bar over the whole video (ADR-0018, ADR-0022). Click to jump, or drag the
 * handle: the handle follows the pointer and the video follows a few times a
 * second. It never takes focus, so shortcuts keep working; with Tab focus, Page
 * Up/Down jump a minute and Home/End go to the ends.
 */
export function SeekBar({ controller, marks = [] }: Props) {
  const { ready, duration } = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const headRef = useRef<HTMLDivElement>(null)
  const [second, setSecond] = useState(0)
  const d = duration ?? 0
  const { ref, dragTime, dragging, hover, handlers } = useScrubber({
    start: 0,
    length: d,
    enabled: ready,
    onSeek: (t) => controller.seek(t),
    pressSeeks: true,
  })

  // Handle follows the pointer while dragging, else the player, every frame without re-rendering React.
  useEffect(() => {
    let frame = 0
    let lastSecond = -1
    const tick = () => {
      const t = dragTime.current ?? controller.time()
      if (headRef.current) headRef.current.style.left = `${percentAt(t, d)}%`
      const s = Math.floor(t)
      if (s !== lastSecond) {
        lastSecond = s
        setSecond(s)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [controller, d, dragTime])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!ready) return
    const jumps: Record<string, () => void> = {
      PageUp: () => controller.nudge(60),
      PageDown: () => controller.nudge(-60),
      Home: () => controller.seek(0),
      End: () => controller.seek(d),
    }
    const jump = jumps[e.key]
    if (jump) {
      e.preventDefault()
      jump()
    }
  }

  return (
    <div className="seekbar-wrap">
      <div
        ref={ref}
        className={`seekbar${ready && d > 0 ? '' : ' disabled'}${dragging ? ' dragging' : ''}`}
        role="slider"
        tabIndex={ready ? 0 : -1}
        aria-label="Seek in video"
        aria-valuemin={0}
        aria-valuemax={Math.round(d)}
        aria-valuenow={second}
        aria-valuetext={`${formatTime(second, 0)} of ${formatTime(d, 0)}`}
        aria-disabled={!ready || d <= 0}
        onKeyDown={onKeyDown}
        {...handlers}
      >
        <div className="seekbar-track" />
        {d > 0 &&
          marks.map((m) => (
            <div
              key={m.id}
              className="seekbar-mark"
              title={m.label}
              style={{ left: `${percentAt(m.start, d)}%`, width: `${Math.max(0.2, percentAt(m.end, d) - percentAt(m.start, d))}%` }}
            />
          ))}
        <div ref={headRef} className="seekbar-head" />
        {hover && (
          <div className="seekbar-tip" style={{ left: `${hover.pct}%` }} aria-hidden="true">
            {formatTime(hover.t, 0)}
          </div>
        )}
      </div>
    </div>
  )
}
