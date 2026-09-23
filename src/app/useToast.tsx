import { useCallback, useEffect, useRef, useState } from 'react'

/** A short message at the bottom of the screen, announced to screen readers. */
export function useToast(durationMs = 3500) {
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error'; n: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(
    (text: string, tone: 'info' | 'error' = 'info') => {
      if (timer.current) clearTimeout(timer.current)
      setMessage((m) => ({ text, tone, n: (m?.n ?? 0) + 1 }))
      timer.current = setTimeout(() => setMessage(null), tone === 'error' ? durationMs * 1.6 : durationMs)
    },
    [durationMs],
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const node = (
    <div className={`toast${message ? ' show' : ''}${message?.tone === 'error' ? ' error-tone' : ''}`} role="status" aria-live="polite">
      {message?.text}
    </div>
  )
  return { toast: node, show }
}
