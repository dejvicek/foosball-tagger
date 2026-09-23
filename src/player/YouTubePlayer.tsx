import { useEffect, useRef, useState } from 'react'
import { loadYouTubeApi } from './loadYouTubeApi'
import { describePlayerError, type PlayerErrorInfo } from './playerErrors'
import { watchUrl } from './youtubeUrl'

interface Props {
  youtubeId: string
  /** Width / height of the video frame; sizes the stage. */
  aspectRatio: number
  /** Called once the player knows the video duration. */
  onDuration?: (seconds: number) => void
}

/**
 * Minimal embedded player with YouTube's own controls (build step 2).
 * Step 3 replaces the controls with the app's own and adds keyboard capture (ADR-0007).
 */
export function YouTubePlayer({ youtubeId, aspectRatio, onDuration }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onDurationRef = useRef(onDuration)
  const [error, setError] = useState<PlayerErrorInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    onDurationRef.current = onDuration
  }, [onDuration])

  useEffect(() => {
    let player: YT.Player | null = null
    let cancelled = false
    const host = hostRef.current
    if (!host) return undefined
    const target = document.createElement('div')
    host.appendChild(target)

    loadYouTubeApi()
      .then((YTApi) => {
        if (cancelled) return
        player = new YTApi.Player(target, {
          videoId: youtubeId,
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, playsinline: 1 },
          events: {
            onReady: (e) => {
              const d = e.target.getDuration()
              if (d > 0) onDurationRef.current?.(d)
            },
            onError: (e) => setError(describePlayerError(e.data)),
          },
        })
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
      player?.destroy()
      host.replaceChildren()
    }
  }, [youtubeId])

  return (
    <div className="player">
      <div className="stage" style={{ aspectRatio: String(aspectRatio), maxWidth: `calc(75vh * ${aspectRatio})` }}>
        <div className="stage-host" ref={hostRef} />
        {(error || loadError) && (
          <div className="stage-error" role="alert">
            {error ? (
              <>
                <p>
                  <strong>{error.reason}</strong>
                </p>
                <p>{error.fix}</p>
                <p>
                  <a href={watchUrl(youtubeId)} target="_blank" rel="noreferrer">
                    Open on YouTube
                  </a>
                </p>
              </>
            ) : (
              <p>{loadError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
