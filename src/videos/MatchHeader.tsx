import { useState } from 'react'
import { FORMATS, type Format, type Game, type Match } from '../data/types'
import { playersLabel } from './format'
import { matchResult, resultLabel } from './matches'

export type MatchField = Partial<Pick<Match, 'format' | 'teammate' | 'opponent' | 'opponent2' | 'best_of' | 'notes'>>

const FORMAT_LABEL: Record<Format, string> = { singles: 'Singles', doubles: 'Doubles' }

function bestOfValue(v: string): number | null | undefined {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 ? n : undefined // undefined: not a value yet, keep typing
}

interface Props {
  match: Match
  number: number
  games: Game[]
  current: boolean
  /** Fields shown; collapsed, the header summarises format and players (ADR-0042). */
  expanded: boolean
  onToggle: () => void
  onSelect: () => void
  onChange: (patch: MatchField) => void
  onDelete: () => void
}

export function MatchHeader({ match, number, games, current, expanded, onToggle, onSelect, onChange, onDelete }: Props) {
  const id = `m-${match.id}`
  const [bestOf, setBestOf] = useState(match.best_of == null ? '' : String(match.best_of))
  const result = resultLabel(match, games)
  const r = matchResult(match, games)
  const summary = [FORMAT_LABEL[match.format], playersLabel(match)].filter(Boolean).join(' · ')

  return (
    <div className="match-head">
      <div className="match-title">
        <h3>
          <button className="disclosure nf" type="button" aria-expanded={expanded} aria-controls={`${id}-fields`} onClick={onToggle}>
            Match {number}
          </button>
        </h3>
        {result && <span className="muted">{result}</span>}
        <button className="btn nf small make-current" type="button" aria-pressed={current} onClick={onSelect} title="B adds games to the current match">
          {current ? 'Current' : 'Make current'}
        </button>
      </div>
      {!expanded && <p className="summary muted">{summary}</p>}
      {r.over && (
        <p className="warn" role="status">
          {r.games} games in a BO{match.best_of}.
        </p>
      )}
      {expanded && (
        <div id={`${id}-fields`}>
          <div className="game-fields">
            <span className="label" id={`${id}-format`}>
              Format
            </span>
            <span className="seg-ctl" role="group" aria-labelledby={`${id}-format`}>
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className="opt nf"
                  aria-pressed={match.format === f}
                  // Singles has no teammate or second opponent (CHECK in 0006_matches.sql).
                  onClick={() => onChange(f === 'singles' ? { format: f, teammate: null, opponent2: null } : { format: f })}
                >
                  {FORMAT_LABEL[f]}
                </button>
              ))}
            </span>
            {match.format === 'doubles' && <NameField id={`${id}-mate`} label="Teammate" value={match.teammate} onChange={(v) => onChange({ teammate: v })} />}
            <NameField id={`${id}-opp`} label={match.format === 'doubles' ? 'Opponent 1' : 'Opponent'} value={match.opponent} onChange={(v) => onChange({ opponent: v })} />
            {match.format === 'doubles' && <NameField id={`${id}-opp2`} label="Opponent 2" value={match.opponent2} onChange={(v) => onChange({ opponent2: v })} />}
            <label htmlFor={`${id}-bo`}>Best of</label>
            <input
              id={`${id}-bo`}
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="—"
              value={bestOf}
              onChange={(e) => {
                setBestOf(e.target.value)
                const v = bestOfValue(e.target.value)
                if (v !== undefined) onChange({ best_of: v })
              }}
            />
            <label htmlFor={`${id}-notes`}>Match notes</label>
            <input
              id={`${id}-notes`}
              type="text"
              value={match.notes ?? ''}
              onChange={(e) => onChange({ notes: e.target.value || null })}
              onBlur={(e) => onChange({ notes: e.target.value.trim() || null })}
            />
          </div>
          <div className="game-actions">
            <button className="btn nf small danger" type="button" onClick={onDelete}>
              Delete match…
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function NameField({ id, label, value, onChange }: { id: string; label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} onBlur={(e) => onChange(e.target.value.trim() || null)} />
    </>
  )
}
