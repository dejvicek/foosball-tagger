import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { loadStatItems, type StatScope } from '../data/stats'
import { listVideos } from '../data/videos'
import { loadGames } from '../data/games'
import { FORMATS, SHOT_TYPES, type Format, type ShotType } from '../data/types'
import { applyFilters, confirmedOnly, opponentsOf, type StatFilters } from '../stats'
import { useQueue } from '../app/QueueProvider'
import { useResource } from '../app/useResource'
import { formatDate, plural, videoTitle } from '../videos/format'
import { sortGames } from '../videos/games'
import { formatTime } from '../player/time'
import { StatsView } from './StatsView'

// URL: #/stats?scope=game|video|range&video=…&game=…&from=…&to=…&shot=Pin,Pull&format=…&opp=…
const NO_OPPONENT = '__none'

export function scopeFromParams(p: URLSearchParams): StatScope {
  const scope = p.get('scope')
  const video = p.get('video')
  const game = p.get('game')
  if (scope === 'game' && video && game) return { kind: 'game', videoId: video, gameId: game }
  if ((scope === 'video' || scope === 'game') && video) return { kind: 'video', videoId: video }
  return { kind: 'range', from: p.get('from') || null, to: p.get('to') || null }
}

export function filtersFromParams(p: URLSearchParams): StatFilters {
  const shots = (p.get('shot') ?? '').split(',').filter((s): s is ShotType => (SHOT_TYPES as readonly string[]).includes(s))
  const format = p.get('format')
  const opp = p.get('opp')
  return {
    shotTypes: shots,
    format: format && (FORMATS as readonly string[]).includes(format) ? (format as Format) : null,
    opponent: opp == null ? null : opp === NO_OPPONENT ? '' : opp,
  }
}

const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

export function StatsPage() {
  const queue = useQueue()
  const [params, setParams] = useSearchParams()
  const scope = scopeFromParams(params)
  const filters = filtersFromParams(params)
  const scopeKey = JSON.stringify(scope)

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const videos = useResource(listVideos)
  const videoId = scope.kind === 'range' ? null : scope.videoId
  const loadVideoGames = useCallback(() => (videoId ? loadGames(queue, videoId) : Promise.resolve([])), [queue, videoId])
  const games = useResource(loadVideoGames)

  // eslint-disable-next-line react/exhaustive-deps -- scopeKey stands for scope
  const load = useCallback(() => loadStatItems(queue, scope), [queue, scopeKey])
  const data = useResource(load)

  const confirmed = useMemo(() => (data.state.kind === 'ready' ? confirmedOnly(data.state.value) : []), [data.state])
  const filtered = useMemo(() => applyFilters(confirmed, filters), [confirmed, filters])
  const opponents = opponentsOf(confirmed)
  const videoList = videos.state.kind === 'ready' ? videos.state.value : []
  const gameList = games.state.kind === 'ready' ? sortGames(games.state.value) : []
  const firstVideo = videoList[0]?.id ?? null

  const toggleShot = (s: ShotType) => {
    const next = filters.shotTypes.includes(s) ? filters.shotTypes.filter((x) => x !== s) : [...filters.shotTypes, s]
    set({ shot: next.join(',') || null })
  }

  return (
    <div className="stats-page">
      <h2>Statistics</h2>
      <section className="card stats-controls" aria-label="What to include">
        <div className="control">
          <span className="label" id="scope-label">
            Scope
          </span>
          <div className="seg-ctl" role="group" aria-labelledby="scope-label">
            <button
              type="button"
              className="opt"
              aria-pressed={scope.kind === 'range'}
              onClick={() => set({ scope: 'range', video: null, game: null })}
            >
              Date range
            </button>
            <button
              type="button"
              className="opt"
              aria-pressed={scope.kind === 'video'}
              onClick={() => set({ scope: 'video', video: videoId ?? firstVideo, game: null })}
              disabled={!firstVideo}
            >
              Video
            </button>
            <button
              type="button"
              className="opt"
              aria-pressed={scope.kind === 'game'}
              onClick={() => set({ scope: 'game', video: videoId ?? firstVideo, game: params.get('game') })}
              disabled={!firstVideo}
            >
              Game
            </button>
          </div>
        </div>

        {scope.kind === 'range' && (
          <div className="control range">
            <label>
              From <input type="date" value={scope.from ?? ''} onChange={(e) => set({ from: e.target.value })} />
            </label>
            <label>
              To <input type="date" value={scope.to ?? ''} onChange={(e) => set({ to: e.target.value })} />
            </label>
            <button className="btn small" type="button" onClick={() => set({ from: daysAgo(29), to: today() })}>
              Last 30 days
            </button>
            <button className="btn small" type="button" onClick={() => set({ from: null, to: null })}>
              All time
            </button>
            <p className="hint muted">Videos without a recorded date count on the day they were added.</p>
          </div>
        )}

        {scope.kind !== 'range' && (
          <div className="control">
            <label htmlFor="st-video">Video</label>
            <select id="st-video" value={videoId ?? ''} onChange={(e) => set({ video: e.target.value, game: null })}>
              {videoList.map((v) => (
                <option key={v.id} value={v.id}>
                  {videoTitle(v)}
                  {v.recorded_on ? ` · ${formatDate(v.recorded_on)}` : ''}
                </option>
              ))}
            </select>
            {params.get('scope') === 'game' && (
              <>
                <label htmlFor="st-game">Game</label>
                <select id="st-game" value={params.get('game') ?? ''} onChange={(e) => set({ game: e.target.value })}>
                  <option value="">Choose a game…</option>
                  {gameList.map((g, i) => (
                    <option key={g.id} value={g.id}>
                      Game {i + 1} · {formatTime(g.start_s, 0)}
                      {g.opponent ? ` · vs ${g.opponent}` : ''}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        <div className="control">
          <span className="label" id="shot-label">
            Shot type
          </span>
          <div className="chips" role="group" aria-labelledby="shot-label">
            {SHOT_TYPES.map((s) => (
              <label key={s} className="chip">
                <input type="checkbox" checked={filters.shotTypes.includes(s)} onChange={() => toggleShot(s)} /> {s}
              </label>
            ))}
          </div>
          <label htmlFor="st-format">Format</label>
          <select id="st-format" value={filters.format ?? ''} onChange={(e) => set({ format: e.target.value || null })}>
            <option value="">All</option>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f === 'singles' ? 'Singles' : 'Doubles'}
              </option>
            ))}
          </select>
          <label htmlFor="st-opp">Opponent</label>
          <select
            id="st-opp"
            value={filters.opponent == null ? '' : filters.opponent === '' ? NO_OPPONENT : filters.opponent}
            onChange={(e) => set({ opp: e.target.value || null })}
          >
            <option value="">All</option>
            {opponents.map((o) => (
              <option key={o || NO_OPPONENT} value={o || NO_OPPONENT}>
                {o || '(no opponent)'}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card" aria-labelledby="results-heading" aria-busy={data.state.kind === 'loading'}>
        <h2 id="results-heading" className="sr-only">
          Results
        </h2>
        {params.get('scope') === 'game' && !params.get('game') ? (
          <p className="muted">Choose a game above.</p>
        ) : data.state.kind === 'loading' ? (
          <p className="muted" role="status">
            Loading…
          </p>
        ) : data.state.kind === 'error' ? (
          <div role="alert">
            <p className="error">{data.state.message}</p>
            <button className="btn" type="button" onClick={data.reload}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <p className="muted scope-summary">
              {filtered.length} of {confirmed.length} confirmed possessions
              {filtered.length !== confirmed.length ? ' match the filters' : ''}
              {scope.kind === 'range' ? ` · ${plural(new Set(confirmed.map((p) => p.videoId)).size, 'video')}` : ''}
            </p>
            <StatsView items={filtered} />
          </>
        )}
      </section>
    </div>
  )
}
