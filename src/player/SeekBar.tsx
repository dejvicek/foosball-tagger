import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from 'react'
import type { PlayerController } from './controller'
import { percentAt, timeAtX } from './scrub'
import { formatTime } from './time'

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

/** While dragging, send at most one seek per this many ms. */
const SCRUB_INTERVAL_MS = 120

/**
 * Seek bar over the whole video (ADR-0018). Clicking it never takes focus, so
 * shortcuts keep working; when focused with Tab, Page Up/Down jump a minute
 * and Home/End go to the ends (arrows work as everywhere else).
 */
export function SeekBar({ controller, marks = [] }: Props) {
  const { ready, duration } = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const barRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const lastScrub = useRef(0)
  const [hover, setHover] = useState<{ t: number; pct: number } | null>(null)
  const [valueText, setValueText] = useState(formatTime(0, 0))
  const d = duration ?? 0

  // Playhead follows the player every frame without re-rendering React.
  useEffect(() => {
    let frame = 0
    let lastSecond = -1
    const tick = () => {
      const t = controller.time()
      if (headRef.current) headRef.current.style.left = `${percentAt(t, d)}%`
      const second = Math.floor(t)
      if (second !== lastSecond) {
        lastSecond = second
        setValueText(formatTime(t, 0))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [controller, d])

  const at = (e: PointerEvent<HTMLDivElement>) => {
    const rect = barRef.current?.getBoundingClientRect()
    return rect ? timeAtX(e.clientX, rect, d) : 0
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!ready || d <= 0 || e.button !== 0) return
    e.preventDefault() // keep focus where it is (TAG-1)
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragging.current = true
    lastScrub.current = performance.now()
    controller.scrub(at(e))
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (d <= 0) return
    const t = at(e)
    setHover({ t, pct: percentAt(t, d) })
    if (dragging.current && performance.now() - lastScrub.current >= SCRUB_INTERVAL_MS) {
      lastScrub.current = performance.now()
      controller.scrub(t)
    }
  }

  const finish = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    controller.seek(at(e))
  }

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
        ref={barRef}
        className={`seekbar${ready && d > 0 ? '' : ' disabled'}`}
        role="slider"
        tabIndex={ready ? 0 : -1}
        aria-label="Seek in video"
        aria-valuemin={0}
        aria-valuemax={Math.round(d)}
        aria-valuenow={Math.round(controller.time())}
        aria-valuetext={`${valueText} of ${formatTime(d, 0)}`}
        aria-disabled={!ready || d <= 0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
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
