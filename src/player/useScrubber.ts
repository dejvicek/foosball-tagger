import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { percentAt, timeAtX } from './scrub'

interface Options {
  /** Time at the left edge of the bar. */
  start: number
  /** Length of time the bar covers. */
  length: number
  enabled: boolean
  /** Full seek (frames load). Called at most every SEEK_INTERVAL_MS while dragging, and on release. */
  onSeek: (t: number) => void
  /**
   * Seek bar: a press seeks at once. Timeline: a press only becomes a drag after
   * the pointer moves, so clicks on possession segments keep working.
   */
  pressSeeks: boolean
}

/** While dragging, seek at most this often so the picture follows without flooding the player. */
const SEEK_INTERVAL_MS = 250
/** Pointer travel that turns a press into a drag (timeline). */
const DRAG_THRESHOLD_PX = 4

/**
 * Click-and-drag seeking over a horizontal bar (ADR-0018, ADR-0022). The pointer is
 * captured during a drag, so it keeps working outside the bar and over the video.
 * `dragTime` holds the time under the pointer while dragging, for the playhead.
 */
export function useScrubber({ start, length, enabled, onSeek, pressSeeks }: Options) {
  const ref = useRef<HTMLDivElement>(null)
  const dragTime = useRef<number | null>(null)
  const press = useRef<{ x: number; id: number } | null>(null)
  const lastSeek = useRef(0)
  const suppressClick = useRef(false)
  const [hover, setHover] = useState<{ t: number; pct: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const timeAt = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    return start + (rect ? timeAtX(clientX, rect, length) : 0)
  }

  const beginDrag = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDragging(true)
    const t = timeAt(e.clientX)
    dragTime.current = t
    lastSeek.current = performance.now()
    onSeek(t)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || length <= 0 || e.button !== 0) return
    e.preventDefault() // keep keyboard focus where it is (TAG-1)
    press.current = { x: e.clientX, id: e.pointerId }
    if (pressSeeks) beginDrag(e)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (length <= 0) return
    const t = timeAt(e.clientX)
    setHover({ t, pct: percentAt(t - start, length) })
    if (!press.current) return
    if (dragTime.current == null) {
      if (Math.abs(e.clientX - press.current.x) >= DRAG_THRESHOLD_PX) beginDrag(e)
      return
    }
    dragTime.current = t
    if (performance.now() - lastSeek.current >= SEEK_INTERVAL_MS) {
      lastSeek.current = performance.now()
      onSeek(t)
    }
  }

  const end = (e: PointerEvent<HTMLDivElement>) => {
    const wasDragging = dragTime.current != null
    press.current = null
    if (!wasDragging) return
    onSeek(timeAt(e.clientX))
    dragTime.current = null
    setDragging(false)
    suppressClick.current = !pressSeeks // the click that ends a drag is not a click on a segment
  }

  /** Swallows the click that ends a drag (timeline segments and background). */
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return
    suppressClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  return {
    ref,
    dragTime,
    dragging,
    hover,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      onPointerLeave: () => setHover(null),
      onClickCapture,
    },
  }
}
