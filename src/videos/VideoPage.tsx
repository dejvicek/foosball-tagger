import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { deleteVideo, getVideo, updateVideo } from '../data/videos'
import { deleteGame, loadGames, possessionCounts, saveGame } from '../data/games'
import { FPS_VALUES, type Fps, type Game, type Side, type VideoSummary } from '../data/types'
import { PlayerController } from '../player/controller'
import { PlayerControls } from '../player/PlayerControls'
import { YouTubePlayer } from '../player/YouTubePlayer'
import { isShortcut, playerAction } from '../player/keys'
import { watchUrl } from '../player/youtubeUrl'
import { ConfirmDialog } from '../app/ConfirmDialog'
import { useQueue } from '../app/QueueProvider'
import { useResource } from '../app/useResource'
import { useToast } from '../app/useToast'
import { deleteSummary, formatDuration, plural, videoTitle } from './format'
import { defaultSide, endGame, gameNumber, setBoundary, startGame, type Plan } from './games'
import { GamesPanel, type GameField } from './GamesPanel'
import type { VideosLocationState } from './VideosPage'

export function VideoPage({ userId }: { userId: string }) {
  const { id = '' } = useParams()
  const location = useLocation()
  const notice = (location.state as VideosLocationState | null)?.notice ?? null
  const load = useCallback(() => getVideo(id), [id])
  const { state, reload, update } = useResource(load)

  const merge = useCallback((patch: Partial<VideoSummary>) => update((v) => (v ? { ...v, ...patch } : v)), [update])

  if (state.kind === 'loading') {
    return (
      <p className="muted" role="status">
        Loading video…
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
        <h2>Video not found</h2>
        <p>It may have been deleted.</p>
        <p>
          <Link to="/">Back to videos</Link>
        </p>
      </section>
    )
  }
  return <VideoScreen key={state.value.id} video={state.value} userId={userId} notice={notice} merge={merge} />
}

const nowIso = () => new Date().toISOString()

function VideoScreen({
  video,
  userId,
  notice,
  merge,
}: {
  video: VideoSummary
  userId: string
  notice: string | null
  merge: (patch: Partial<VideoSummary>) => void
}) {
  const queue = useQueue()
  const [controller] = useState(() => new PlayerController())
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const duration = snapshot.duration ?? video.duration_s
  const { toast, show } = useToast()

  const loadVideoGames = useCallback(() => loadGames(queue, video.id), [queue, video.id])
  const gamesResource = useResource(loadVideoGames)
  const games = gamesResource.state.kind === 'ready' ? gamesResource.state.value : null
  const setGames = gamesResource.update
  const [firstSide, setFirstSide] = useState<Side | null>(null)
  const [toDelete, setToDelete] = useState<{ game: Game; possessions: number | null } | null>(null)

  // Store the duration the player reports, so the list can show it and games can be checked against it.
  const storedDuration = useRef(video.duration_s)
  useEffect(() => {
    const d = snapshot.duration
    if (d == null || (storedDuration.current != null && Math.abs(storedDuration.current - d) < 0.5)) return
    storedDuration.current = d
    updateVideo(video.id, { duration_s: d }).then(
      () => merge({ duration_s: d }),
      (err: unknown) => console.warn('Could not store the video duration', err),
    )
  }, [snapshot.duration, video.id, merge])

  const apply = useCallback(
    (plan: Plan) => {
      if (!plan.ok) {
        show(plan.message, 'error')
        return
      }
      setGames(() => plan.games)
      plan.save.forEach((g) => saveGame(queue, g))
      show(plan.message)
    },
    [queue, setGames, show],
  )

  const start = useCallback(() => {
    if (!games) return
    const at = controller.time()
    const side = games.length > 0 ? defaultSide(games, at) : firstSide
    apply(startGame(games, at, { id: crypto.randomUUID(), userId, videoId: video.id, now: nowIso(), side }, duration))
  }, [games, controller, apply, userId, video.id, firstSide, duration])

  const end = useCallback(() => {
    if (!games) return
    apply(endGame(games, controller.time(), nowIso(), duration))
  }, [games, controller, apply, duration])

  const boundary = useCallback(
    (gameId: string, which: 'start' | 'end') => {
      if (!games) return
      apply(setBoundary(games, gameId, which, controller.time(), nowIso(), duration))
    },
    [games, controller, apply, duration],
  )

  const change = useCallback(
    (gameId: string, patch: GameField) => {
      const game = games?.find((g) => g.id === gameId)
      if (!game || (Object.keys(patch) as (keyof GameField)[]).every((k) => game[k] === patch[k])) return
      const next = { ...game, ...patch, updated_at: nowIso() }
      setGames((gs) => gs.map((g) => (g.id === gameId ? next : g)))
      saveGame(queue, next, 500) // SYN-3: edits are debounced
    },
    [games, queue, setGames],
  )

  const askDelete = useCallback((game: Game) => {
    setToDelete({ game, possessions: null })
    possessionCounts([game.id]).then(
      (counts) => setToDelete((d) => (d?.game.id === game.id ? { game, possessions: counts.get(game.id) ?? 0 } : d)),
      () => {}, // offline: the dialog says possessions go with the game, without a count
    )
  }, [])

  const confirmDelete = () => {
    if (!toDelete || !games) return
    const n = gameNumber(games, toDelete.game.id)
    deleteGame(queue, toDelete.game.id)
    setGames((gs) => gs.filter((g) => g.id !== toDelete.game.id))
    setToDelete(null)
    show(`Deleted Game ${n}.`)
  }

  // Keyboard (TAG-1 rules): player keys, plus B / E for games on this screen only (ADR-0010).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (toDelete || !isShortcut(e) || !snapshot.ready) return
      const action = playerAction(e)
      if (action) {
        e.preventDefault()
        if (action.kind === 'toggle') controller.toggle()
        else if (action.kind === 'nudge') controller.nudge(action.seconds)
        else if (action.kind === 'frame') controller.frameStep(action.direction, video.fps)
        else show(`Speed ${controller.stepRate(action.direction)}×`)
        return
      }
      const k = e.key.toLowerCase()
      if (k === 'b') {
        e.preventDefault()
        start()
      } else if (k === 'e') {
        e.preventDefault()
        end()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [controller, snapshot.ready, video.fps, start, end, show, toDelete])

  return (
    <div className="video-page">
      <p className="crumbs">
        <Link to="/">← Videos</Link>
      </p>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <h2>{videoTitle(video)}</h2>
      <p className="muted meta">
        {video.duration_s != null && <>{formatDuration(video.duration_s)} · </>}
        <a href={watchUrl(video.youtube_id)} target="_blank" rel="noreferrer">
          Open on YouTube
        </a>
      </p>
      <div className="video-grid">
        <section aria-label="Player">
          <YouTubePlayer youtubeId={video.youtube_id} aspectRatio={video.aspect_ratio ?? 16 / 9} controller={controller} />
          <PlayerControls controller={controller} fps={video.fps} />
          <p className="hint muted">
            Frame steps move about 1/{video.fps} s; YouTube cannot step exact frames. Set the frame rate under Details.
          </p>
        </section>
        <div>
          {gamesResource.state.kind === 'loading' && (
            <p className="muted" role="status">
              Loading games…
            </p>
          )}
          {gamesResource.state.kind === 'error' && (
            <section className="card" role="alert">
              <p className="error">{gamesResource.state.message}</p>
              <button className="btn" type="button" onClick={gamesResource.reload}>
                Try again
              </button>
            </section>
          )}
          {games && (
            <GamesPanel
              videoId={video.id}
              games={games}
              duration={duration}
              ready={snapshot.ready}
              firstSide={firstSide}
              onFirstSide={setFirstSide}
              onStart={start}
              onEnd={end}
              onSeek={(t) => controller.seek(t)}
              onChange={change}
              onBoundary={boundary}
              onDelete={askDelete}
            />
          )}
        </div>
      </div>
      <div className="video-lower">
        <VideoDetailsForm video={video} onSaved={merge} />
        <DeleteVideo video={video} />
      </div>
      {toDelete && games && (
        <ConfirmDialog
          title={`Delete Game ${gameNumber(games, toDelete.game.id)}?`}
          confirmLabel="Delete game"
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        >
          <p>
            {toDelete.possessions == null
              ? 'Its possessions are deleted with it.'
              : toDelete.possessions === 0
                ? 'It has no possessions yet.'
                : `This also deletes its ${plural(toDelete.possessions, 'possession')}.`}{' '}
            It cannot be undone.
          </p>
        </ConfirmDialog>
      )}
      {toast}
    </div>
  )
}

function VideoDetailsForm({ video, onSaved }: { video: VideoSummary; onSaved: (patch: Partial<VideoSummary>) => void }) {
  const [title, setTitle] = useState(video.title ?? '')
  const [recordedOn, setRecordedOn] = useState(video.recorded_on ?? '')
  const [fps, setFps] = useState<Fps>(video.fps)
  const [notes, setNotes] = useState(video.notes ?? '')
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' } | { kind: 'error'; message: string }>({
    kind: 'idle',
  })

  const patch = {
    title: title.trim() || null,
    recorded_on: recordedOn || null,
    fps,
    notes: notes.trim() || null,
  }
  const dirty =
    patch.title !== video.title || patch.recorded_on !== video.recorded_on || patch.fps !== video.fps || patch.notes !== video.notes

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus({ kind: 'saving' })
    try {
      const saved = await updateVideo(video.id, patch)
      onSaved(saved)
      setStatus({ kind: 'saved' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <section className="card" aria-labelledby="details-heading">
      <h3 id="details-heading">Details</h3>
      <form className="fields" onSubmit={onSubmit}>
        <label htmlFor="v-title">Title</label>
        <input id="v-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label htmlFor="v-date">Recorded on</label>
        <input id="v-date" type="date" value={recordedOn} onChange={(e) => setRecordedOn(e.target.value)} />

        <label htmlFor="v-fps">Frame rate</label>
        <select id="v-fps" value={fps} onChange={(e) => setFps(Number(e.target.value) as Fps)} aria-describedby="v-fps-hint">
          {FPS_VALUES.map((f) => (
            <option key={f} value={f}>
              {f} fps
            </option>
          ))}
        </select>
        <p id="v-fps-hint" className="hint muted">
          Used for approximate frame stepping.
        </p>

        <label htmlFor="v-notes">Notes</label>
        <textarea id="v-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="row">
          <button className="btn primary" type="submit" disabled={!dirty || status.kind === 'saving'}>
            {status.kind === 'saving' ? 'Saving…' : 'Save details'}
          </button>
          {status.kind === 'saved' && !dirty && (
            <span className="muted" role="status">
              Saved
            </span>
          )}
        </div>
        {status.kind === 'error' && (
          <p className="error" role="alert">
            {status.message}
          </p>
        )}
      </form>
    </section>
  )
}

function DeleteVideo({ video }: { video: VideoSummary }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await deleteVideo(video.id)
      const state: VideosLocationState = { notice: `Deleted “${videoTitle(video)}”.` }
      navigate('/', { state })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h3>Delete</h3>
      <button className="btn danger" type="button" onClick={() => setOpen(true)}>
        Delete video…
      </button>
      {open && (
        <ConfirmDialog
          title={`Delete “${videoTitle(video)}”?`}
          confirmLabel="Delete video"
          busyLabel="Deleting…"
          busy={busy}
          error={error}
          onConfirm={confirm}
          onCancel={() => setOpen(false)}
        >
          <p>{deleteSummary(video)}</p>
          <p className="muted">The video itself stays on YouTube.</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
