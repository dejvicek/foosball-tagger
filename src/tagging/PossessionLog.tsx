import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { Possession, ReviewStatus } from '../data/types'
import type { PlayerController } from '../player/controller'
import { formatTime } from '../player/time'
import type { TagField } from './draft'
import { FOUL_LIMIT_S, anchor, isFoul, possessionAt, possessionLength } from './possessions'
import { KEY } from './keyLabels'
import { useKeyboardLayout } from '../player/useKeyboardLayout'

interface Props {
  /** In time order, with their number (null for rejected rows). */
  rows: { p: Possession; n: number | null }[]
  controller: PlayerController
  /** Open a possession in the tag panel and seek to `t`, if any (ADR-0030). */
  onSelect: (id: string, t: number | null) => void
  onReview: (id: string, status: ReviewStatus) => void
  onDelete: (id: string) => void
  /** The possession open in the tag panel. */
  editingId: string | null
}

const COLUMNS: { field: TagField; label: string }[] = [
  { field: 'shot_type', label: 'Shot type' },
  { field: 'setup', label: 'Setup' },
  { field: 'hole', label: 'Hole' },
  { field: 'shot_direction', label: 'Shot direction' },
  { field: 'execution', label: 'Execution' },
  { field: 'result', label: 'Result' },
]


/** The row under the playhead, updated only when it changes. */
function useActiveId(rows: Props['rows'], controller: PlayerController): string | null {
  const [active, setActive] = useState<string | null>(null)
  const rowsRef = useRef(rows)
  useEffect(() => {
    rowsRef.current = rows
  }, [rows])
  useEffect(() => {
    let frame = 0
    let last: string | null = null
    const tick = () => {
      const id = possessionAt(
        rowsRef.current.map((r) => r.p),
        controller.time(),
      )?.id ?? null
      if (id !== last) {
        last = id
        setActive(id)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [controller])
  return active
}

/** Possession log: read-only; click a row to edit it in the tag panel (TAG-7, ADR-0030). */
export function PossessionLog({ rows, controller, onSelect, onReview, onDelete, editingId }: Props) {
  useKeyboardLayout()
  const active = useActiveId(rows, controller)
  const [armed, setArmed] = useState<string | null>(null)
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current)
    },
    [],
  )

  const askDelete = (id: string) => {
    if (armTimer.current) clearTimeout(armTimer.current)
    if (armed === id) {
      setArmed(null)
      onDelete(id)
      return
    }
    setArmed(id)
    armTimer.current = setTimeout(() => setArmed(null), 3000)
  }

  if (rows.length === 0) {
    return <p className="muted">No possessions yet. Press {KEY.ballSet} when the ball is set and {KEY.shot} at the shot.</p>
  }

  return (
    <div className="scroll">
      <table className="log" aria-label="Possessions">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Start</th>
            <th>Shot / end</th>
            <th className="num">Length</th>
            {COLUMNS.map((c) => (
              <th key={c.field}>{c.label}</th>
            ))}
            <th>Review</th>
            <th>
              <span className="sr-only">Delete</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, n }) => {
            const name = n != null ? `possession ${n}` : 'rejected possession'
            const len = possessionLength(p)
            const a = anchor(p)
            const classes = ['pick', p.id === active ? 'active' : '', p.id === editingId ? 'editing' : '', p.review_status === 'rejected' ? 'rejected' : '', p.review_status === 'unreviewed' ? 'unreviewed' : '']
            return (
              <tr
                key={p.id}
                className={classes.filter(Boolean).join(' ')}
                aria-selected={p.id === editingId}
                onClick={(e: MouseEvent) => {
                  // Buttons in the row do their own thing.
                  if (!(e.target instanceof Element && e.target.closest('button'))) onSelect(p.id, a != null ? a - 1 : null)
                }}
                title="Edit in the tag panel"
              >
                <td className="num">{n ?? '–'}</td>
                <td>
                  {a != null ? (
                    <button className="seek nf" type="button" onClick={() => onSelect(p.id, a - 1)} title="Edit, from one second before this possession">
                      {formatTime(p.start_s)}
                    </button>
                  ) : (
                    '–'
                  )}
                </td>
                <td>
                  {p.shot_s != null ? (
                    <button className="seek nf" type="button" onClick={() => onSelect(p.id, p.shot_s as number)} title="Edit, from the shot">
                      {formatTime(p.shot_s)}
                    </button>
                  ) : (
                    '–'
                  )}
                </td>
                {isFoul(len) ? (
                  <td className="num foul" title={`Foul: over ${FOUL_LIMIT_S} s`}>
                    {(len as number).toFixed(1)} s · foul
                  </td>
                ) : (
                  <td className="num">{len != null ? `${len.toFixed(1)} s` : '–'}</td>
                )}
                {COLUMNS.map((c) => (
                  <td key={c.field} className={p[c.field] == null ? 'muted' : undefined}>
                    {p[c.field] ?? '–'}
                  </td>
                ))}
                <td>
                  {p.review_status === 'unreviewed' && (
                    <span className="review">
                      <button className="btn small nf" type="button" onClick={() => onReview(p.id, 'confirmed')}>
                        Confirm
                      </button>
                      <button className="btn small nf danger" type="button" onClick={() => onReview(p.id, 'rejected')}>
                        Reject
                      </button>
                    </span>
                  )}
                  {p.review_status === 'rejected' && (
                    <span className="review">
                      <span className="muted">Rejected</span>
                      <button className="btn small nf" type="button" onClick={() => onReview(p.id, 'confirmed')}>
                        Confirm
                      </button>
                    </span>
                  )}
                  {p.review_status === 'confirmed' && <span className="muted">{p.source === 'auto' ? 'Auto' : ''}</span>}
                </td>
                <td>
                  <button
                    className={`del nf${armed === p.id ? ' armed' : ''}`}
                    type="button"
                    onClick={() => askDelete(p.id)}
                    aria-label={armed === p.id ? `Confirm: delete ${name}` : `Delete ${name}`}
                  >
                    {armed === p.id ? 'Delete?' : '×'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
