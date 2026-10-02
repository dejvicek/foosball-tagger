import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useCinemaPage } from '../player/useCinema'
import { Link, useParams } from 'react-router'
import { getVideo } from '../data/videos'
import { loadGames } from '../data/games'
import { deletePossession, loadPossessions, savePossession } from '../data/possessions'
import type { Game, Possession, ReviewStatus, VideoSummary } from '../data/types'
import { PlayerController } from '../player/controller'
import { PlayerControls } from '../player/PlayerControls'
import { YouTubePlayer } from '../player/YouTubePlayer'
import { isShortcut, playerAction } from '../player/keys'
import { formatTime } from '../player/time'
import { useQueue } from '../app/QueueProvider'
import { useResource } from '../app/useResource'
import { useToast } from '../app/useToast'
import { gameNumber, gameRange } from '../videos/games'
import { playersLabel, videoTitle } from '../videos/format'
import { reduce, reduceEdit, sameDraft, toDraft, type Draft, type DraftEvent } from './draft'
import { loadDraft, storeDraft } from './draftStore'
import { tagAction } from './keymap'
import { fromDraft, numberPossessions } from './possessions'
import { PossessionLog } from './PossessionLog'
import { TagPanel } from './TagPanel'
import { Timeline } from './Timeline'
import { Help } from './Help'
import { StatsView } from '../statsView/StatsView'
import { toStatItem } from '../data/stats'
import { confirmedOnly } from '../stats'

interface Loaded {
  video: VideoSummary
  games: Game[]
  game: Game
  possessions: Possession[]
}

export function TaggingPage({ userId }: { userId: string }) {
  const { id = '', gameId = '' } = useParams()
  const queue = useQueue()
  const load = useCallback(async (): Promise<Loaded | null> => {
    const [video, games, possessions] = await Promise.all([getVideo(id), loadGames(queue, id), loadPossessions(queue, gameId)])
    const game = games.find((g) => g.id === gameId)
    return video && game ? { video, games, game, possessions } : null
  }, [id, gameId, queue])
  const { state, reload } = useResource(load)

  if (state.kind === 'loading') {
    return (
      <p className="muted" role="status">
        Loading game…
      </p>
    )
  }
  if (state.kind === 'error') {
    return (
      <section className="card" role="alert">
        <p className="error">{state.message}</p>
        <button className="btn" type="button" onClick={reload}>
          Try again
        </button>
      </section>
    )
  }
  if (!state.value) {
    return (
      <section className="card">
        <h2>Game not found</h2>
        <p>It may have been deleted.</p>
        <p>
          <Link to={`/videos/${id}`}>Back to the video</Link>
        </p>
      </section>
    )
  }
  return <TaggingScreen key={gameId} loaded={state.value} userId={userId} />
}

const nowIso = () => new Date().toISOString()

function TaggingScreen({ loaded, userId }: { loaded: Loaded; userId: string }) {
  const { video, games, game } = loaded
  const queue = useQueue()
  const [controller] = useState(() => new PlayerController())
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const duration = snapshot.duration ?? video.duration_s
  const range = gameRange(game, games, duration)
  const shownRange = { start: range.start, end: Number.isFinite(range.end) ? range.end : range.start + 600 }
  const label = `Game ${gameNumber(games, game.id)}`
  const { toast, show } = useToast()

  const [possessions, setPossessions] = useState(loaded.possessions)
  const [draft, setDraftState] = useState<Draft>(() => loadDraft(game.id))
  const draftRef = useRef(draft)
  // A saved possession open in the panel (ADR-0030); the new-possession draft waits meanwhile.
  const [editing, setEditingState] = useState<{ id: string; draft: Draft } | null>(null)
  const editingRef = useRef(editing)
  const setEditing = useCallback((e: { id: string; draft: Draft } | null) => {
    editingRef.current = e
    setEditingState(e)
  }, [])

  const setDraft = useCallback(
    (d: Draft) => {
      draftRef.current = d
      setDraftState(d)
      storeDraft(game.id, d)
    },
    [game.id],
  )

  const rows = useMemo(() => numberPossessions(possessions), [possessions])
  // Live game statistics from what is tagged here, synced or not (STA-4 game scope).
  const statItems = useMemo(() => confirmedOnly(possessions.map((p) => toStatItem(p, game, video))), [possessions, game, video])
  const numbered = useMemo(() => rows.filter((r): r is { p: Possession; n: number } => r.n != null), [rows])

  // GAM-3: the tagging screen opens at the game's start.
  const sought = useRef(false)
  useEffect(() => {
    if (!snapshot.ready || sought.current) return
    sought.current = true
    const t = controller.time()
    if (t < range.start || t > range.end) controller.seek(range.start)
  }, [snapshot.ready, controller, range.start, range.end])

  const update = useCallback(
    (id: string, patch: Partial<Possession>) => {
      const current = possessions.find((p) => p.id === id)
      if (!current) return
      let next: Possession = { ...current, ...patch, updated_at: nowIso() }
      if (next.shot_type === 'No shot') next = { ...next, hole: null, shot_direction: null, result: null, execution: null }
      setPossessions((list) => list.map((p) => (p.id === id ? next : p)))
      savePossession(queue, next)
    },
    [possessions, queue],
  )

  const numberOf = useCallback((id: string) => {
    const n = rows.find((r) => r.p.id === id)?.n
    return n != null ? `possession ${n}` : 'the rejected possession'
  }, [rows])

  /** Open a possession in the panel (ADR-0030), from the timeline or the log. */
  const select = useCallback(
    (id: string, t: number | null) => {
      const p = possessions.find((x) => x.id === id)
      if (!p) return
      const current = editingRef.current
      if (current && current.id !== id) {
        const before = possessions.find((x) => x.id === current.id)
        if (before && !sameDraft(toDraft(before), current.draft)) show(`Discarded the unsaved changes to ${numberOf(current.id)}.`)
      }
      if (current?.id !== id) setEditing({ id, draft: toDraft(p) })
      if (t != null) controller.seek(t)
    },
    [possessions, controller, setEditing, show, numberOf],
  )

  const dispatch = useCallback(
    (event: DraftEvent) => {
      const t = controller.time()
      const current = editingRef.current
      if (current) {
        const out = reduceEdit(current.draft, event, { t, range, gameLabel: label })
        if (out.error) show(out.error, 'error')
        else if (out.save) {
          update(current.id, out.save)
          setEditing(null)
          show(`Saved the changes to ${numberOf(current.id)}.`)
        } else if (out.cancel) setEditing(null)
        else setEditing({ ...current, draft: out.draft })
        return
      }
      const out = reduce(draftRef.current, event, { t, range, gameLabel: label })
      if (out.error) {
        // Kept for diagnosing refusals caused by an unexpected player time.
        const d = draftRef.current
        console.warn(
          `Tag refused: ${event.kind} at t=${t} (game ${range.start}–${range.end}, draft start=${d.start_s} shot=${d.shot_s})`,
          JSON.stringify(controller.debugState()),
        )
        show(out.error, 'error')
        return
      }
      if (out.save) {
        const p = fromDraft(out.save, { id: crypto.randomUUID(), userId, gameId: game.id, now: nowIso() })
        savePossession(queue, p) // SYN-1
        setPossessions((list) => [...list, p])
      }
      setDraft(out.draft)
      if (out.message) show(out.message)
    },
    [controller, range, label, show, userId, game.id, queue, setDraft, setEditing, update, numberOf],
  )

  const remove = useCallback(
    (id: string) => {
      if (editingRef.current?.id === id) setEditing(null)
      deletePossession(queue, id)
      setPossessions((list) => list.filter((p) => p.id !== id))
      show('Deleted the possession.')
    },
    [queue, show, setEditing],
  )

  // Keyboard: player keys and tag keys (TAG-1).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null
      if (e.key === 'Escape' && target?.closest('input, select, textarea') && target instanceof HTMLElement) {
        target.blur()
        return
      }
      if (!isShortcut(e) || document.querySelector('.modal')) return
      const player = playerAction(e)
      if (player) {
        if (!snapshot.ready) return
        e.preventDefault()
        if (player.kind === 'toggle') controller.toggle()
        else if (player.kind === 'nudge') controller.nudge(player.seconds)
        else if (player.kind === 'frame') controller.frameStep(player.direction, video.fps)
        else show(`Speed ${controller.stepRate(player.direction)}×`)
        return
      }
      const action = tagAction(e, game.my_side)
      if (!action) return
      e.preventDefault()
      dispatch(action)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [controller, snapshot.ready, video.fps, dispatch, show, game.my_side])

  const ar = video.aspect_ratio ?? 16 / 9
  const cinema = useCinemaPage()
  return (
    <div className="tagging-page">
      <p className="crumbs">
        <Link to={`/videos/${video.id}`}>← {videoTitle(video)}</Link>
      </p>
      <h2>
        {label}
        <span className="muted game-meta">
          {' '}
          · {formatTime(range.start)}–{Number.isFinite(range.end) ? formatTime(range.end) : 'end'} · {game.format === 'doubles' ? 'doubles' : 'singles'}, on the {game.my_side}
          {playersLabel(game) ? ` · ${playersLabel(game)}` : ''}
        </span>
      </h2>
      <div className={cinema ? 'grid cinema' : 'grid'} style={{ '--ar': ar } as CSSProperties}>
        <section aria-label="Player" className="player-col">
          <YouTubePlayer youtubeId={video.youtube_id} aspectRatio={ar} controller={controller} />
          <PlayerControls controller={controller} fps={video.fps} />
          <Timeline
            range={shownRange}
            possessions={numbered}
            draft={draft}
            controller={controller}
            onSeek={(t) => controller.seek(t)}
            onSelect={select}
            editingId={editing?.id ?? null}
          />
          <Help side={game.my_side} />
        </section>
        <TagPanel draft={editing?.draft ?? draft} controller={controller} onEvent={dispatch} editing={editing ? numberOf(editing.id) : undefined} side={game.my_side} />
      </div>
      <div className="lower">
        <section className="card" aria-labelledby="stats-heading">
          <h2 id="stats-heading">Game numbers</h2>
          <StatsView items={statItems} />
          <p className="note">
            <Link to={`/stats?scope=game&video=${video.id}&game=${game.id}`}>Filter these, or compare with other games →</Link>
          </p>
        </section>
        <section className="card" aria-labelledby="log-heading">
          <h2 id="log-heading">Possession log</h2>
          <PossessionLog
            rows={rows}
            controller={controller}
            onSelect={select}
            onReview={(id: string, status: ReviewStatus) => update(id, { review_status: status })}
            onDelete={remove}
            editingId={editing?.id ?? null}
          />
        </section>
      </div>
      {toast}
    </div>
  )
}
