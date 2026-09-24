import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useParams } from 'react-router'
import { getVideo } from '../data/videos'
import { loadGames } from '../data/games'
import { deletePossession, loadPossessions, savePossession } from '../data/possessions'
import type { Game, Possession, VideoSummary } from '../data/types'
import { PlayerController } from '../player/controller'
import { PlayerControls } from '../player/PlayerControls'
import { YouTubePlayer } from '../player/YouTubePlayer'
import { isShortcut, playerAction } from '../player/keys'
import { formatTime } from '../player/time'
import { useQueue } from '../app/QueueProvider'
import { useResource } from '../app/useResource'
import { useToast } from '../app/useToast'
import { gameNumber, gameRange } from '../videos/games'
import { videoTitle } from '../videos/format'
import { reduce, type Draft, type DraftEvent } from './draft'
import { loadDraft, storeDraft } from './draftStore'
import { tagAction } from './keymap'
import { fromDraft, sortPossessions } from './possessions'
import { PossessionLog, type PossessionPatch } from './PossessionLog'
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
  const undoStack = useRef<string[]>([])

  const setDraft = useCallback(
    (d: Draft) => {
      draftRef.current = d
      setDraftState(d)
      storeDraft(game.id, d)
    },
    [game.id],
  )

  const sorted = useMemo(() => sortPossessions(possessions), [possessions])
  const rows = useMemo(() => {
    let n = 0
    return sorted.map((p) => ({ p, n: p.review_status === 'rejected' ? null : ++n }))
  }, [sorted])
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

  const dispatch = useCallback(
    (event: DraftEvent) => {
      const t = controller.time()
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
        undoStack.current.push(p.id)
        setPossessions((list) => [...list, p])
      }
      setDraft(out.draft)
      if (out.message) show(out.message)
    },
    [controller, range, label, show, userId, game.id, queue, setDraft],
  )

  // Undo (⌘Z / Ctrl+Z / Backspace): delete the most recently saved possession on this page (ADR-0021).
  const undo = useCallback(() => {
    const ids = new Set(possessions.map((p) => p.id))
    let last = undoStack.current.pop()
    while (last && !ids.has(last)) last = undoStack.current.pop()
    if (!last) {
      show('Nothing to undo: no possession was saved on this page yet.', 'error')
      return
    }
    const target = last
    deletePossession(queue, target)
    setPossessions((list) => list.filter((p) => p.id !== target))
    show('Deleted the last saved possession.')
  }, [possessions, queue, show])

  const update = useCallback(
    (id: string, patch: PossessionPatch, flushDelayMs: number) => {
      const current = possessions.find((p) => p.id === id)
      if (!current) return
      let next: Possession = { ...current, ...patch, updated_at: nowIso() }
      if (next.shot_type === 'No shot') next = { ...next, direction: null, hole: null, result: null, execution: null }
      setPossessions((list) => list.map((p) => (p.id === id ? next : p)))
      savePossession(queue, next, flushDelayMs)
    },
    [possessions, queue],
  )

  const setTime = useCallback(
    (id: string, field: 'start_s' | 'shot_s') => {
      const p = possessions.find((x) => x.id === id)
      if (!p) return
      const t = controller.time()
      if (t < range.start - 0.05 || t > range.end + 0.05) {
        show(`${formatTime(t)} is outside ${label}. Adjust the game’s start or end on the video screen if it belongs here.`, 'error')
        return
      }
      const start = field === 'start_s' ? t : p.start_s
      const shot = field === 'shot_s' ? t : p.shot_s
      if (start != null && shot != null && shot < start) {
        show(`The shot (${formatTime(shot)}) can’t be before the start (${formatTime(start)}).`, 'error')
        return
      }
      update(id, { [field]: t }, 0)
    },
    [possessions, controller, range, label, show, update],
  )

  const remove = useCallback(
    (id: string) => {
      deletePossession(queue, id)
      setPossessions((list) => list.filter((p) => p.id !== id))
      show('Deleted the possession.')
    },
    [queue, show],
  )

  // Keyboard: player keys and tag keys (TAG-1).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null
      if (e.key === 'Escape' && target?.closest('input, select, textarea') && target instanceof HTMLElement) {
        target.blur()
        return
      }
      // ⌘Z / Ctrl+Z undo outside fields (inside a field it stays the field's own undo).
      const undoChord = (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'z' && !e.shiftKey
      if (undoChord && !target?.closest('input, select, textarea') && !document.querySelector('.modal')) {
        e.preventDefault()
        undo()
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
      const action = tagAction(e)
      if (!action) return
      e.preventDefault()
      if (action.kind === 'undo') undo()
      else dispatch(action)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [controller, snapshot.ready, video.fps, dispatch, undo, show])

  const side = game.my_side === 'left' ? 'left' : 'right'
  return (
    <div className="tagging-page">
      <p className="crumbs">
        <Link to={`/videos/${video.id}`}>← {videoTitle(video)}</Link>
      </p>
      <h2>
        {label}
        <span className="muted game-meta">
          {' '}
          · {formatTime(range.start)}–{Number.isFinite(range.end) ? formatTime(range.end) : 'end'} · my goal on the {side}
          {game.opponent ? ` · vs ${game.opponent}` : ''}
        </span>
      </h2>
      <div className="grid">
        <section aria-label="Player">
          <YouTubePlayer youtubeId={video.youtube_id} aspectRatio={video.aspect_ratio ?? 16 / 9} controller={controller} />
          <PlayerControls controller={controller} fps={video.fps} />
          <Timeline range={shownRange} possessions={numbered} draft={draft} controller={controller} onSeek={(t) => controller.seek(t)} />
        </section>
        <TagPanel draft={draft} controller={controller} onEvent={dispatch} onUndo={undo} />
      </div>
      <div className="lower">
        <section className="card" aria-labelledby="stats-heading">
          <h2 id="stats-heading">Game numbers</h2>
          <StatsView items={statItems} />
          <p className="note">
            <Link to={`/stats?scope=game&video=${video.id}&game=${game.id}`}>Filter these, or compare with other games →</Link>
          </p>
          <Help />
        </section>
        <section className="card" aria-labelledby="log-heading">
          <h2 id="log-heading">Possession log</h2>
          <PossessionLog
            rows={rows}
            controller={controller}
            onSeek={(t) => controller.seek(t)}
            onChange={(id, patch) => update(id, patch, 500)}
            onSetTime={setTime}
            onDelete={remove}
          />
        </section>
      </div>
      {toast}
    </div>
  )
}
