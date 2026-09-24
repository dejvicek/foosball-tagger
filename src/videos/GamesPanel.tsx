import { useState } from 'react'
import { Link } from 'react-router'
import { FORMATS, SIDES, type Format, type Game, type Side } from '../data/types'
import { formatTime } from '../player/time'
import { gameRange, sortGames } from './games'
import { keyLabel } from '../player/keyboardLayout'
import { useKeyboardLayout } from '../player/useKeyboardLayout'

export type GameField = Partial<Pick<Game, 'my_side' | 'format' | 'opponent' | 'my_score' | 'opp_score' | 'notes'>>

interface Props {
  videoId: string
  games: Game[]
  duration: number | null
  ready: boolean
  firstSide: Side | null
  onFirstSide: (side: Side) => void
  onStart: () => void
  onEnd: () => void
  onSeek: (t: number) => void
  onChange: (id: string, patch: GameField) => void
  onBoundary: (id: string, which: 'start' | 'end') => void
  onDelete: (game: Game) => void
}

const SIDE_LABEL: Record<Side, string> = { left: 'Left', right: 'Right' }
const FORMAT_LABEL: Record<Format, string> = { singles: 'Singles', doubles: 'Doubles' }

function scoreValue(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 ? n : null
}

export function GamesPanel(props: Props) {
  useKeyboardLayout()
  const { games, firstSide, onFirstSide, onStart, onEnd, ready } = props
  const sorted = sortGames(games)
  const hasOpen = sorted.some((g) => g.end_s == null)

  return (
    <section className="card games" aria-labelledby="games-heading">
      <h2 id="games-heading">Games</h2>
      {sorted.length === 0 && (
        <div className="first-side">
          <p id="side-q">Which side of the frame is your goal on?</p>
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
      </div>
      {sorted.length === 0 ? (
        <p className="muted">Play the video and press B where a game starts and E where it ends.</p>
      ) : (
        <ol className="game-list">
          {sorted.map((g, i) => (
            <GameRow key={g.id} game={g} index={i + 1} {...props} />
          ))}
        </ol>
      )}
    </section>
  )
}

function GameRow({ game, index, games, duration, videoId, onSeek, onChange, onBoundary, onDelete }: Props & { game: Game; index: number }) {
  const range = gameRange(game, games, duration)
  const length = Number.isFinite(range.end) ? range.end - range.start : null
  const id = `g-${game.id}`
  const [myScore, setMyScore] = useState(game.my_score == null ? '' : String(game.my_score))
  const [oppScore, setOppScore] = useState(game.opp_score == null ? '' : String(game.opp_score))

  return (
    <li className="game">
      <div className="game-head">
        <h3>Game {index}</h3>
        <span className="game-range">
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
        </span>
        <Link className="btn nf tag-link" to={`/videos/${videoId}/games/${game.id}`}>
          Tag →
        </Link>
      </div>
      <div className="game-fields">
        <label htmlFor={`${id}-side`}>My goal</label>
        <select id={`${id}-side`} value={game.my_side} onChange={(e) => onChange(game.id, { my_side: e.target.value as Side })}>
          {SIDES.map((s) => (
            <option key={s} value={s}>
              {SIDE_LABEL[s]}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-format`}>Format</label>
        <select id={`${id}-format`} value={game.format} onChange={(e) => onChange(game.id, { format: e.target.value as Format })}>
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {FORMAT_LABEL[f]}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-opp`}>Opponent</label>
        <input
          id={`${id}-opp`}
          type="text"
          value={game.opponent ?? ''}
          onChange={(e) => onChange(game.id, { opponent: e.target.value || null })}
          onBlur={(e) => onChange(game.id, { opponent: e.target.value.trim() || null })}
        />
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
    </li>
  )
}
