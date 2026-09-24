import { useEffect, useRef, type MouseEvent } from 'react'
import type { Possession } from '../data/types'
import type { PlayerController } from '../player/controller'
import { percentAt, timeAtX } from '../player/scrub'
import { formatTime } from '../player/time'
import { useScrubber } from '../player/useScrubber'
import type { Draft } from './draft'
import { OUTCOME_LABEL, anchor, describe, outcomeOf, type Outcome } from './possessions'

interface Props {
  /** The game's time range; the strip covers only this (TAG-6). */
  range: { start: number; end: number }
  /** Numbered possessions to draw, in time order. */
  possessions: { p: Possession; n: number }[]
  draft: Draft
  controller: PlayerController
  onSeek: (t: number) => void
}

const LEGEND: (Outcome | 'draft')[] = ['goal', 'nogoal', 'noshot', 'untagged', 'candidate', 'draft']

/**
 * Timeline strip: one segment per possession and a playhead (TAG-6). Click to seek,
 * click a segment to jump just before it, or drag anywhere to scrub through the game.
 */
export function Timeline({ range, possessions, draft, controller, onSeek }: Props) {
  const headRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef<HTMLDivElement>(null)
  const length = Math.max(1, range.end - range.start)
  const pos = (t: number) => percentAt(t - range.start, length)
  const { ref: stripRef, dragTime, dragging, hover, handlers } = useScrubber({ start: range.start, length, enabled: true, onSeek, pressSeeks: false })

  // Playhead and the running draft follow the player every frame.
  useEffect(() => {
    let frame = 0
    const tick = () => {
      const t = dragTime.current ?? controller.time()
      if (headRef.current) headRef.current.style.left = `${pos(t)}%`
      if (draftRef.current && draft.start_s != null) {
        const a = pos(draft.start_s)
        const b = pos(draft.shot_s ?? t)
        draftRef.current.style.left = `${Math.min(a, b)}%`
        draftRef.current.style.width = `${Math.abs(b - a)}%`
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  })

  const onStripClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget && !(e.target as Element).classList.contains('strip-bg')) return
    const rect = stripRef.current?.getBoundingClientRect()
    if (rect) onSeek(range.start + timeAtX(e.clientX, rect, length))
  }

  return (
    <div className="timeline">
      <div
        ref={stripRef}
        className={`strip nf${dragging ? ' dragging' : ''}`}
        onClick={onStripClick}
        role="group"
        aria-label="Game timeline: click or drag to seek, click a possession to jump to one second before it"
        {...handlers}
      >
        <div className="strip-bg" />
        {possessions.map(({ p, n }) => {
          const a = anchor(p)
          if (a == null) return null
          const b = p.shot_s ?? a
          const outcome = outcomeOf(p)
          const label = describe(p, n)
          return (
            <button
              key={p.id}
              type="button"
              className={`seg nf ${outcome}`}
              style={{ left: `${pos(a)}%`, width: `${Math.max(0, pos(b) - pos(a))}%` }}
              title={label}
              aria-label={`${label}. ${OUTCOME_LABEL[outcome]}. Jump to one second before it.`}
              onClick={() => onSeek(a - 1)}
            />
          )
        })}
        {draft.start_s != null && <div ref={draftRef} className="seg draft" aria-hidden="true" />}
        <div ref={headRef} className="playhead" />
      </div>
      {hover && (
        <div className="strip-tip" style={{ left: `${hover.pct}%` }} aria-hidden="true">
          {formatTime(hover.t)}
        </div>
      )}
      <div className="legend" aria-hidden="true">
        {LEGEND.map((o) => (
          <span key={o}>
            <i className={`swatch ${o}`} />
            {OUTCOME_LABEL[o]}
          </span>
        ))}
      </div>
    </div>
  )
}
