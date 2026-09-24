import { useEffect, useRef, useState } from 'react'
import { DIRECTIONS, EXECUTIONS, HOLES, RESULTS, SETUPS, SHOT_TYPES, type Possession } from '../data/types'
import type { PlayerController } from '../player/controller'
import { formatTime } from '../player/time'
import type { TagField } from './draft'
import { anchor, possessionAt, possessionLength } from './possessions'
import { KEY } from './keyLabels'
import { useKeyboardLayout } from '../player/useKeyboardLayout'

export type PossessionPatch = Partial<Pick<Possession, TagField | 'start_s' | 'shot_s' | 'review_status'>>

interface Props {
  /** In time order, with their number (null for rejected rows). */
  rows: { p: Possession; n: number | null }[]
  controller: PlayerController
  onSeek: (t: number) => void
  onChange: (id: string, patch: PossessionPatch) => void
  /** Set start or shot to the current player time. */
  onSetTime: (id: string, field: 'start_s' | 'shot_s') => void
  onDelete: (id: string) => void
}

const COLUMNS: { field: TagField; label: string; options: readonly string[] }[] = [
  { field: 'setup', label: 'Setup', options: SETUPS },
  { field: 'shot_type', label: 'Shot type', options: SHOT_TYPES },
  { field: 'direction', label: 'Direction', options: DIRECTIONS },
  { field: 'hole', label: 'Hole', options: HOLES },
  { field: 'result', label: 'Result', options: RESULTS },
  { field: 'execution', label: 'Execution', options: EXECUTIONS },
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

/** Possession log: every field editable inline (TAG-7). */
export function PossessionLog({ rows, controller, onSeek, onChange, onSetTime, onDelete }: Props) {
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
            const classes = [p.id === active ? 'active' : '', p.review_status === 'rejected' ? 'rejected' : '', p.review_status === 'unreviewed' ? 'unreviewed' : '']
            return (
              <tr key={p.id} className={classes.filter(Boolean).join(' ')}>
                <td className="num">{n ?? '–'}</td>
                <td>
                  <span className="time-cell">
                    {a != null ? (
                      <button className="seek" type="button" onClick={() => onSeek(a - 1)} title="Jump to one second before this possession">
                        {formatTime(p.start_s)}
                      </button>
                    ) : (
                      '–'
                    )}
                    <button className="now nf" type="button" onClick={() => onSetTime(p.id, 'start_s')} aria-label={`Set start of ${name} to the current time`} title="Set to the current time">
                      ⌖
                    </button>
                  </span>
                </td>
                <td>
                  <span className="time-cell">
                    {p.shot_s != null ? (
                      <button className="seek" type="button" onClick={() => onSeek(p.shot_s as number)} title="Jump to the shot">
                        {formatTime(p.shot_s)}
                      </button>
                    ) : (
                      '–'
                    )}
                    <button className="now nf" type="button" onClick={() => onSetTime(p.id, 'shot_s')} aria-label={`Set shot of ${name} to the current time`} title="Set to the current time">
                      ⌖
                    </button>
                  </span>
                </td>
                <td className="num">{len != null ? `${len.toFixed(1)} s` : '–'}</td>
                {COLUMNS.map((c) => (
                  <td key={c.field}>
                    <select
                      aria-label={`${c.label} for ${name}`}
                      value={p[c.field] ?? ''}
                      disabled={p.shot_type === 'No shot' && c.field !== 'shot_type' && c.field !== 'setup'}
                      onChange={(e) => onChange(p.id, { [c.field]: e.target.value || null })}
                    >
                      <option value="">–</option>
                      {c.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
                <td>
                  {p.review_status === 'unreviewed' && (
                    <span className="review">
                      <button className="btn small nf" type="button" onClick={() => onChange(p.id, { review_status: 'confirmed' })}>
                        Confirm
                      </button>
                      <button className="btn small nf danger" type="button" onClick={() => onChange(p.id, { review_status: 'rejected' })}>
                        Reject
                      </button>
                    </span>
                  )}
                  {p.review_status === 'rejected' && (
                    <span className="review">
                      <span className="muted">Rejected</span>
                      <button className="btn small nf" type="button" onClick={() => onChange(p.id, { review_status: 'confirmed' })}>
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
