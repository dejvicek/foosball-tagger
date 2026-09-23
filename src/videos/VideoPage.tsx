import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { deleteVideo, getVideo, updateVideo } from '../data/videos'
import { FPS_VALUES, type Fps, type VideoSummary } from '../data/types'
import { YouTubePlayer } from '../player/YouTubePlayer'
import { watchUrl } from '../player/youtubeUrl'
import { deleteSummary, formatDuration, videoTitle } from './format'
import type { VideosLocationState } from './VideosPage'
import { useResource } from '../app/useResource'

export function VideoPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const notice = (location.state as VideosLocationState | null)?.notice ?? null
  const load = useCallback(() => getVideo(id), [id])
  const { state, reload, update } = useResource(load)

  const video = state.kind === 'ready' ? state.value : null
  const merge = useCallback(
    (patch: Partial<VideoSummary>) => update((v) => (v ? { ...v, ...patch } : v)),
    [update],
  )

  // Store the duration the player reports, so the list can show it and later steps can use it.
  const onDuration = useCallback(
    (seconds: number) => {
      if (!video || (video.duration_s != null && Math.abs(video.duration_s - seconds) < 0.5)) return
      updateVideo(video.id, { duration_s: seconds }).then(
        () => merge({ duration_s: seconds }),
        (err: unknown) => console.warn('Could not store the video duration', err),
      )
    },
    [video, merge],
  )

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

  const v = state.value
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
      <h2>{videoTitle(v)}</h2>
      <p className="muted meta">
        {v.duration_s != null && <>{formatDuration(v.duration_s)} · </>}
        <a href={watchUrl(v.youtube_id)} target="_blank" rel="noreferrer">
          Open on YouTube
        </a>
      </p>
      <div className="video-grid">
        <YouTubePlayer youtubeId={v.youtube_id} aspectRatio={v.aspect_ratio ?? 16 / 9} onDuration={onDuration} />
        <div className="video-side">
          <VideoDetailsForm key={v.id} video={v} onSaved={merge} />
          <section className="card">
            <h3>Games</h3>
            <p className="muted">Marking games (B / E) arrives in build step 3.</p>
          </section>
          <DeleteVideo video={v} />
        </div>
      </div>
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
  const cancelRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const opener = openerRef.current
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [open])

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
      <button ref={openerRef} className="btn danger" type="button" onClick={() => setOpen(true)}>
        Delete video…
      </button>
      {open && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && !busy && setOpen(false)}>
          <div className="box" role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-desc">
            <h2 id="del-title">Delete “{videoTitle(video)}”?</h2>
            <p id="del-desc">{deleteSummary(video)}</p>
            <p className="muted">The video itself stays on YouTube.</p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="row end">
              <button ref={cancelRef} className="btn" type="button" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn danger-solid" type="button" onClick={confirm} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete video'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
