import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { loadScope, scopeItems, type ScopeData, type StatScope } from '../data/stats'
import { listVideos } from '../data/videos'
import { loadGames } from '../data/games'
import { loadMatches } from '../data/matches'
import { FORMATS, SHOT_TYPES, type Format, type ShotType } from '../data/types'
import { applyFilters, confirmedOnly, opponentsOf, type StatFilters } from '../stats'
import { useQueue } from '../app/QueueProvider'
import { useResource } from '../app/useResource'
import { formatDate, playersLabel, plural, videoTitle } from '../videos/format'
import { sortGames } from '../videos/games'
import { gameInMatch, gameLabel, matchNumber } from '../videos/matches'
import { formatTime } from '../player/time'
import { StatsView } from './StatsView'
import { ExportCard } from './ExportCard'

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

/** e.g. foosball-dQw4w9WgXcQ-match-1-game-2.csv, foosball-2026-09-01-to-2026-09-30.csv */
export function exportFileName(scope: StatScope, data: ScopeData): string {
  if (scope.kind === 'range') {
    return scope.from == null && scope.to == null ? 'foosball-all.csv' : `foosball-${scope.from ?? 'start'}-to-${scope.to ?? today()}.csv`
  }
  const yt = data.videos[0]?.youtube_id ?? 'video'
  if (scope.kind === 'video') return `foosball-${yt}.csv`
  const game = data.games.find((g) => g.id === scope.gameId)
  const m = game ? matchNumber(data.matches, data.games, game.match_id) : 0
  const k = game ? gameInMatch(data.games, game) : 0
  return `foosball-${yt}-match-${m}-game-${k}.csv`
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
  const loadVideoGames = useCallback(
    () =>
      videoId
        ? Promise.all([loadMatches(queue, videoId), loadGames(queue, videoId)]).then(([matches, games]) => ({ matches, games }))
        : Promise.resolve({ matches: [], games: [] }),
    [queue, videoId],
  )
  const games = useResource(loadVideoGames)

  // eslint-disable-next-line react/exhaustive-deps -- scopeKey stands for scope
  const load = useCallback(() => loadScope(queue, scope), [queue, scopeKey])
  const data = useResource(load)

  const scopeData = data.state.kind === 'ready' ? data.state.value : null
  const all = useMemo(() => (scopeData ? scopeItems(scopeData) : []), [scopeData])
  const confirmed = useMemo(() => confirmedOnly(all), [all])
  const filtersKey = JSON.stringify(filters)
  // eslint-disable-next-line react/exhaustive-deps -- filtersKey stands for filters
  const filtered = useMemo(() => applyFilters(confirmed, filters), [confirmed, filtersKey])
  // Export follows the filters too; candidates are filtered the same way (ADR-0035).
  // eslint-disable-next-line react/exhaustive-deps -- filtersKey stands for filters
  const keepIds = useMemo(() => new Set(applyFilters(all, filters).map((p) => p.id)), [all, filtersKey])
  const keep = useCallback((id: string) => keepIds.has(id), [keepIds])
  const opponents = opponentsOf(confirmed)
  const videoList = videos.state.kind === 'ready' ? videos.state.value : []
  const ms = games.state.kind === 'ready' ? games.state.value.matches : []
  const gs = games.state.kind === 'ready' ? games.state.value.games : []
  const gameList = sortGames(gs)
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
                  {gameList.map((g) => {
                    const match = ms.find((m) => m.id === g.match_id)
                    const players = match ? playersLabel(match) : ''
                    return (
                      <option key={g.id} value={g.id}>
                        {gameLabel(ms, gs, g)} · {formatTime(g.start_s, 0)}
                        {players ? ` · ${players}` : ''}
                      </option>
                    )
                  })}
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

      {scopeData && !(params.get('scope') === 'game' && !params.get('game')) && (
        <ExportCard data={scopeData} keep={keep} fileName={exportFileName(scope, scopeData)} />
      )}
    </div>
  )
}
