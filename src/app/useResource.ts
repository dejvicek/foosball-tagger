import { useCallback, useEffect, useRef, useState } from 'react'

export type Resource<T> = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; value: T }

/**
 * Loads `load()` on mount and whenever `load` changes (wrap it in useCallback);
 * stale responses are ignored. `reload` retries; `update` edits the loaded value.
 */
export function useResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<Resource<T>>({ kind: 'loading' })
  const latest = useRef<{ cancelled: boolean } | null>(null)

  const run = useCallback(() => {
    if (latest.current) latest.current.cancelled = true
    const ticket = { cancelled: false }
    latest.current = ticket
    load().then(
      (value) => !ticket.cancelled && setState({ kind: 'ready', value }),
      (err: unknown) =>
        !ticket.cancelled && setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) }),
    )
    return ticket
  }, [load])

  useEffect(() => {
    const ticket = run()
    return () => {
      ticket.cancelled = true
    }
  }, [run])

  const reload = useCallback(() => {
    setState({ kind: 'loading' })
    run()
  }, [run])

  const update = useCallback((fn: (value: T) => T) => {
    setState((s) => (s.kind === 'ready' ? { kind: 'ready', value: fn(s.value) } : s))
  }, [])

  return { state, reload, update }
}
