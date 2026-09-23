import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { addVideo, listVideos } from '../data/videos'
import type { VideoSummary } from '../data/types'
import { parseYouTubeUrl } from '../player/youtubeUrl'
import { useResource } from '../app/useResource'
import { formatDate, formatDuration, plural, videoTitle } from './format'

export interface VideosLocationState {
  notice?: string
}

export function VideosPage() {
  const location = useLocation()
  const notice = (location.state as VideosLocationState | null)?.notice ?? null
  const { state: list, reload } = useResource(listVideos)

  return (
    <>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <AddVideoForm />
      <section className="card" aria-labelledby="videos-heading">
        <h2 id="videos-heading">Videos</h2>
        {list.kind === 'loading' && (
          <p className="muted" role="status">
            Loading videos…
          </p>
        )}
        {list.kind === 'error' && (
          <div role="alert">
            <p className="error">{list.message}</p>
            <button className="btn" type="button" onClick={reload}>
              Try again
            </button>
          </div>
        )}
        {list.kind === 'ready' && <VideoList videos={list.value} />}
      </section>
    </>
  )
}

function AddVideoForm() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseYouTubeUrl(url)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { video, existed } = await addVideo(parsed.youtubeId)
      const state: VideosLocationState = existed ? { notice: 'This video is already in your list, so it was opened.' } : {}
      navigate(`/videos/${video.id}`, { state })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <section className="card add-video" aria-labelledby="add-heading">
      <h2 id="add-heading">Add a video</h2>
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="video-url">YouTube link</label>
        <div className="row">
          <input
            id="video-url"
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError(null)
            }}
            aria-describedby="video-url-hint"
            aria-invalid={error ? true : undefined}
          />
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Adding…' : 'Add video'}
          </button>
        </div>
        <p id="video-url-hint" className="hint muted">
          The video must be Public or Unlisted and allow embedding. Private videos do not play here. Uploads, live-stream
          archives and Shorts links all work.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}

function VideoList({ videos }: { videos: VideoSummary[] }) {
  if (videos.length === 0) {
    return <p className="muted">No videos yet. Paste a YouTube link above to add your first practice session.</p>
  }
  return (
    <div className="scroll">
      <table className="videos">
        <thead>
          <tr>
            <th>Title</th>
            <th>Recorded</th>
            <th className="num">Games</th>
            <th className="num">Possessions</th>
            <th>Analysis</th>
          </tr>
        </thead>
        <tbody>
          {videos.map((v) => (
            <tr key={v.id}>
              <td className="title-cell">
                <Link to={`/videos/${v.id}`}>{videoTitle(v)}</Link>
                {v.duration_s != null && <span className="muted"> · {formatDuration(v.duration_s)}</span>}
              </td>
              <td>{v.recorded_on ? formatDate(v.recorded_on) : <span className="muted">No date</span>}</td>
              <td className="num">{v.game_count}</td>
              <td className="num" title={plural(v.confirmed_possession_count, 'confirmed possession')}>
                {v.confirmed_possession_count}
              </td>
              <td>{v.job_running ? <span className="badge">Running</span> : <span className="muted">–</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
