import type { ReactNode } from 'react'
import {
  EXECUTION_NOTE,
  SMALL_SAMPLE,
  byHole,
  byLength,
  bySetup,
  byShot,
  executionVsResult,
  headline,
  type GroupRow,
  type Ratio,
  type StatItem,
} from '../stats'

/** "58% (7/12)" with a † when the sample is small (STA-2, STA-3). */
export function Pct({ r }: { r: Ratio }) {
  return (
    <span className="pct">
      {r.pct == null ? '–' : `${Math.round(r.pct)}%`} <span className="muted">({r.num}/{r.den})</span>
      {r.small && r.den > 0 && (
        <sup className="small-mark" title={`Fewer than ${SMALL_SAMPLE} attempts`}>
          †<span className="sr-only"> small sample</span>
        </sup>
      )}
    </span>
  )
}

const seconds = (v: number | null) => (v == null ? '–' : `${v.toFixed(1)} s`)
const blank = (v: string | null) => v ?? '–'

function Table({ head, children, numeric }: { head: string[]; children: ReactNode; numeric: number[] }) {
  return (
    <div className="scroll">
      <table className="stats-table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={numeric.includes(i) ? 'num' : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Groups({ rows, label, withProper = true }: { rows: GroupRow[]; label: string; withProper?: boolean }) {
  return (
    <Table head={withProper ? [label, 'Shots', 'Conv.', 'Proper'] : [label, 'Shots', 'Conv.']} numeric={withProper ? [1, 2, 3] : [1, 2]}>
      {rows.map((g) => (
        <tr key={g.label} className={g.indent ? 'sub' : undefined}>
          <td>{g.label}</td>
          <td className="num">{g.attempts}</td>
          <td className="num">
            <Pct r={g.conversion} />
          </td>
          {withProper && (
            <td className="num">
              <Pct r={g.proper} />
            </td>
          )}
        </tr>
      ))}
    </Table>
  )
}

/**
 * Statistics for a set of confirmed possessions (STA-5..10). The caller picks the
 * scope and applies filters.
 */
export function StatsView({ items }: { items: StatItem[] }) {
  if (items.length === 0) {
    return <p className="muted">No confirmed possessions in this selection yet.</p>
  }
  const h = headline(items)
  const shots = byShot(items)
  const matrix = executionVsResult(items)

  return (
    <div className="stats">
      <div className="kpis">
        <div className="kpi">
          <b>{h.possessions}</b>
          <span>possessions</span>
        </div>
        <div className="kpi">
          <b>{h.shots}</b>
          <span>shots</span>
        </div>
        <div className="kpi">
          <b>
            <Pct r={h.conversion} />
          </b>
          <span>conversion</span>
        </div>
        <div className="kpi">
          <b>
            <Pct r={h.proper} />
          </b>
          <span>proper execution</span>
        </div>
        <div className="kpi">
          <b>{seconds(h.medianLength)}</b>
          <span>median possession ({h.medianOf})</span>
        </div>
        <div className="kpi">
          <b>
            <Pct r={h.noShotShare} />
          </b>
          <span>no-shot possessions</span>
        </div>
      </div>
      <p className="note">
        † Fewer than {SMALL_SAMPLE} attempts: a rough indication, not a conclusion. Blank fields are left out of every
        percentage; they never count as misses.
      </p>

      <h3>By shot</h3>
      {shots.length === 0 ? (
        <p className="muted">No shots yet.</p>
      ) : (
        <Table head={['Shot', 'Att.', 'Goals', 'Conv.', 'Proper', 'Avg poss.']} numeric={[1, 2, 3, 4, 5]}>
          {shots.map((s) => (
            <tr key={`${s.shotType}|${s.direction}|${s.hole}`}>
              <td>
                {blank(s.shotType)} · {blank(s.direction)} · {blank(s.hole)}
              </td>
              <td className="num">{s.attempts}</td>
              <td className="num">{s.goals}</td>
              <td className="num">
                <Pct r={s.conversion} />
              </td>
              <td className="num">
                <Pct r={s.proper} />
              </td>
              <td className="num">{seconds(s.avgLength)}</td>
            </tr>
          ))}
        </Table>
      )}

      <h3>Execution vs. result</h3>
      <Table head={['Execution', 'Goal', 'No goal', 'Conv.']} numeric={[1, 2, 3]}>
        {matrix.map((m) => (
          <tr key={m.execution}>
            <td>{m.execution}</td>
            <td className="num">{m.goals}</td>
            <td className="num">{m.noGoals}</td>
            <td className="num">
              <Pct r={m.conversion} />
            </td>
          </tr>
        ))}
      </Table>
      <p className="note">{EXECUTION_NOTE}</p>

      <h3>Conversion by possession length</h3>
      <Groups rows={byLength(items)} label="Length" />
      <p className="note">Shots with both a start and a shot time only.</p>

      <h3>By setup</h3>
      <Groups rows={bySetup(items)} label="Setup" />

      <h3>By hole lane</h3>
      <Groups rows={byHole(items)} label="Hole" withProper={false} />
    </div>
  )
}
