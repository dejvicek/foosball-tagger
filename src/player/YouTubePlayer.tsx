import { useEffect, useRef, useState } from 'react'
import type { PlayerController } from './controller'
import { loadYouTubeApi } from './loadYouTubeApi'
import { describePlayerError, type PlayerErrorInfo } from './playerErrors'
import { watchUrl } from './youtubeUrl'

interface Props {
  youtubeId: string
  /** Width / height of the video frame; sizes the stage. */
  aspectRatio: number
  controller: PlayerController
}

/**
 * YouTube embed without YouTube's own controls or keyboard handling; the app's
 * controls and shortcuts drive it through `controller` (PRD §4.4, ADR-0007).
 */
export function YouTubePlayer({ youtubeId, aspectRatio, controller }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<PlayerErrorInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [iframeFocused, setIframeFocused] = useState(false)

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
          playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0 },
          events: {
            onReady: (e) => {
              e.target.getIframe().setAttribute('tabindex', '-1')
              controller.attach(e.target)
            },
            onStateChange: (e) => controller.onStateChange(e.data),
            onPlaybackRateChange: (e) => controller.onRateChange(e.data),
            onError: (e) => setError(describePlayerError(e.data)),
          },
        })
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
      controller.detach()
      player?.destroy()
      host.replaceChildren()
    }
  }, [youtubeId, controller])

  // A focused iframe swallows key events. When the page loses focus to the player,
  // take it back; if the browser refuses, show a hint (PRD §4.4, ADR-0007).
  useEffect(() => {
    const onBlur = () => {
      setTimeout(() => {
        const active = document.activeElement
        if (!(active instanceof HTMLIFrameElement) || !stageRef.current?.contains(active)) return
        stageRef.current.focus({ preventScroll: true })
        setIframeFocused(document.activeElement === active)
      }, 0)
    }
    const onFocus = () => setIframeFocused(false)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return (
    <div className="player">
      <div
        className="stage"
        ref={stageRef}
        tabIndex={-1}
        aria-label="Video"
        style={{ aspectRatio: String(aspectRatio), maxWidth: `calc(70vh * ${aspectRatio})` }}
      >
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
      {iframeFocused && (
        <p className="focus-hint" role="status">
          Click outside the video to use shortcuts.
        </p>
      )}
    </div>
  )
}
