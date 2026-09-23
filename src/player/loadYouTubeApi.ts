/// <reference types="youtube" />

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void
  }
}

let loading: Promise<typeof YT> | null = null

/** Loads https://www.youtube.com/iframe_api once, lazily (PRD §4.1, §7). */
export function loadYouTubeApi(): Promise<typeof YT> {
  if (loading) return loading
  loading = new Promise<typeof YT>((resolve, reject) => {
    if (typeof window.YT !== 'undefined' && typeof window.YT.Player === 'function') {
      resolve(window.YT)
      return
    }
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Could not load the YouTube player. Check your connection, or disable blockers for youtube.com.'))
    }
    document.head.appendChild(script)
  })
  return loading
}
