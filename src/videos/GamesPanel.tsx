import { useState } from 'react'
import { Link } from 'react-router'
import { SIDES, type Game, type Match, type Side } from '../data/types'
import { formatTime } from '../player/time'
import { gameRange } from './games'
import { currentMatch, matchGames, sortMatches } from './matches'
import { MatchHeader, type MatchField } from './MatchHeader'
import { keyLabel } from '../player/keyboardLayout'
import { useKeyboardLayout } from '../player/useKeyboardLayout'

export type GameField = Partial<Pick<Game, 'my_side' | 'my_score' | 'opp_score' | 'notes'>>

interface Props {
  videoId: string
  matches: Match[]
  games: Game[]
  duration: number | null
  ready: boolean
  firstSide: Side | null
  currentMatchId: string | null
  onNewMatch: () => void
  onSelectMatch: (id: string) => void
  onMatchChange: (id: string, patch: MatchField) => void
  onDeleteMatch: (match: Match) => void
  onFirstSide: (side: Side) => void
  onStart: () => void
  onEnd: () => void
  onSeek: (t: number) => void
  onChange: (id: string, patch: GameField) => void
  onBoundary: (id: string, which: 'start' | 'end') => void
  onDelete: (game: Game) => void
}

const SIDE_LABEL: Record<Side, string> = { left: 'Left', right: 'Right' }

function scoreValue(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 ? n : null
}

export function GamesPanel(props: Props) {
  useKeyboardLayout()
  const { matches, games, firstSide, onFirstSide, onStart, onEnd, ready } = props
  const hasOpen = games.some((g) => g.end_s == null)
  const current = currentMatch(matches, games, props.currentMatchId)
  // Rows the user opened or closed; the rest follow the defaults below (ADR-0042).
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const toggle = (id: string, expanded: boolean) => setToggled((t) => ({ ...t, [id]: !expanded }))

  return (
    <section className="card games" aria-labelledby="games-heading">
      <h2 id="games-heading">Matches</h2>
      {games.length === 0 && (
        <div className="first-side">
          <p id="side-q">Which side of the frame do you stand on?</p>
          <div className="seg-ctl" role="group" aria-labelledby="side-q">
            {SIDES.map((s) => (
              <button key={s} type="button" className="opt nf" aria-pressed={firstSide === s} onClick={() => onFirstSide(s)}>
                {SIDE_LABEL[s]}
              </button>
            ))}
          </div>
          <p className="hint muted">Later games start with the side of the game before them; you can change it per game.</p>
        </div>
      )}
      <div className="markrow">
        <button className="btn nf primary" type="button" onClick={onStart} disabled={!ready}>
          {hasOpen ? 'End & start next' : 'Start game'} <kbd>{keyLabel('KeyB')}</kbd>
        </button>
        <button className="btn nf" type="button" onClick={onEnd} disabled={!ready || !hasOpen}>
          End game <kbd>{keyLabel('KeyE')}</kbd>
        </button>
        <button className="btn nf" type="button" onClick={props.onNewMatch} disabled={!ready}>
          New match <kbd>{keyLabel('KeyM')}</kbd>
        </button>
      </div>
      {matches.length === 0 ? (
        <p className="muted">Play the video and press B where a game starts and E where it ends. M starts a new match.</p>
      ) : (
        <ol className="match-list">
          {sortMatches(matches, games).map((m, i) => {
            const isCurrent = m.id === current?.id
            const expanded = toggled[m.id] ?? isCurrent
            const mine = matchGames(games, m.id)
            return (
              <li key={m.id} className={isCurrent ? 'match current' : 'match'}>
                <MatchHeader
                  match={m}
                  number={i + 1}
                  games={games}
                  current={isCurrent}
                  expanded={expanded}
                  onToggle={() => toggle(m.id, expanded)}
                  onSelect={() => props.onSelectMatch(m.id)}
                  onChange={(patch) => props.onMatchChange(m.id, patch)}
                  onDelete={() => props.onDeleteMatch(m)}
                />
                {mine.length === 0 ? (
                  <p className="muted">No games yet. Press B where its first game starts.</p>
                ) : (
                  <ol className="game-list">
                    {mine.map((g, k) => {
                      // Open by default: a game still running, and the latest game of the current match (scores go in after E).
                      const gameExpanded = toggled[g.id] ?? (g.end_s == null || (isCurrent && k === mine.length - 1))
                      return <GameRow key={g.id} game={g} index={k + 1} expanded={gameExpanded} onToggle={() => toggle(g.id, gameExpanded)} {...props} />
                    })}
                  </ol>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function scoreLabel(g: Game): string {
  return g.my_score == null && g.opp_score == null ? '' : `${g.my_score ?? '–'}:${g.opp_score ?? '–'}`
}

interface RowProps {
  game: Game
  index: number
  expanded: boolean
  onToggle: () => void
}

function GameRow({ game, index, expanded, onToggle, games, duration, videoId, onSeek, onChange, onBoundary, onDelete }: Props & RowProps) {
  const range = gameRange(game, games, duration)
  const length = Number.isFinite(range.end) ? range.end - range.start : null
  const id = `g-${game.id}`
  const [myScore, setMyScore] = useState(game.my_score == null ? '' : String(game.my_score))
  const [oppScore, setOppScore] = useState(game.opp_score == null ? '' : String(game.opp_score))

  return (
    <li className="game">
      <div className="game-head">
        <h3>
          <button className="disclosure nf" type="button" aria-expanded={expanded} aria-controls={`${id}-fields`} onClick={onToggle}>
            Game {index}
          </button>
        </h3>
        <Link className="btn nf tag-link" to={`/videos/${videoId}/games/${game.id}`}>
          Tag →
        </Link>
      </div>
      <p className="game-range">
        <button className="seek" type="button" onClick={() => onSeek(game.start_s)} title="Seek to the start">
          {formatTime(game.start_s)}
        </button>
        {' – '}
        {game.end_s != null ? (
          <button className="seek" type="button" onClick={() => onSeek(Math.max(game.start_s, (game.end_s ?? 0) - 1))} title="Seek to one second before the end">
            {formatTime(game.end_s)}
          </button>
        ) : (
          <span className="badge open">open</span>
        )}
        {length != null && <span className="muted"> · {formatTime(length, 0)}</span>}
        {!expanded && <span className="muted">{` · ${[SIDE_LABEL[game.my_side], scoreLabel(game)].filter(Boolean).join(' · ')}`}</span>}
      </p>
      {expanded && (
        <div id={`${id}-fields`}>
          <div className="game-fields">
            <label htmlFor={`${id}-side`}>My side</label>
            <select id={`${id}-side`} value={game.my_side} onChange={(e) => onChange(game.id, { my_side: e.target.value as Side })}>
              {SIDES.map((s) => (
                <option key={s} value={s}>
                  {SIDE_LABEL[s]}
                </option>
              ))}
            </select>
            <span className="label" id={`${id}-score`}>
              Score
            </span>
            <span className="score" role="group" aria-labelledby={`${id}-score`}>
              <input
                aria-label="My score"
                type="number"
                min={0}
                inputMode="numeric"
                value={myScore}
                onChange={(e) => {
                  setMyScore(e.target.value)
                  onChange(game.id, { my_score: scoreValue(e.target.value) })
                }}
              />
              <span aria-hidden="true">:</span>
              <input
                aria-label="Opponent score"
                type="number"
                min={0}
                inputMode="numeric"
                value={oppScore}
                onChange={(e) => {
                  setOppScore(e.target.value)
                  onChange(game.id, { opp_score: scoreValue(e.target.value) })
                }}
              />
            </span>
            <label htmlFor={`${id}-notes`}>Notes</label>
            <input
              id={`${id}-notes`}
              type="text"
              value={game.notes ?? ''}
              onChange={(e) => onChange(game.id, { notes: e.target.value || null })}
              onBlur={(e) => onChange(game.id, { notes: e.target.value.trim() || null })}
            />
          </div>
          <div className="game-actions">
            <button className="btn nf small" type="button" onClick={() => onBoundary(game.id, 'start')} title="Move the start to the current time">
              Start here
            </button>
            <button className="btn nf small" type="button" onClick={() => onBoundary(game.id, 'end')} title="Move the end to the current time">
              End here
            </button>
            <button className="btn nf small danger" type="button" onClick={() => onDelete(game)}>
              Delete…
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
