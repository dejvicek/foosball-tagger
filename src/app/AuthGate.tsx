import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authErrorFromUrl, cleanAuthParams, watchSession } from '../data/auth'
import { readEnv } from '../data/env'
import { SignIn } from './SignIn'

type State =
  | { kind: 'loading' }
  | { kind: 'signed-out'; linkError: string | null }
  | { kind: 'signed-in'; session: Session }
  | { kind: 'config-error'; message: string }

function initialState(): State {
  try {
    readEnv(import.meta.env)
    return { kind: 'loading' }
  } catch (err) {
    return { kind: 'config-error', message: err instanceof Error ? err.message : String(err) }
  }
}

/** Renders children only for a signed-in user (PRD §4.3); everything else sees the sign-in screen. */
export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [state, setState] = useState<State>(initialState)

  useEffect(() => {
    if (state.kind === 'config-error') return undefined
    const linkError = authErrorFromUrl(window.location.href)
    return watchSession((session) => {
      cleanAuthParams()
      setState(session ? { kind: 'signed-in', session } : { kind: 'signed-out', linkError })
    })
    // Subscribe once; later state changes come from the subscription itself.
    // eslint-disable-next-line react/exhaustive-deps
  }, [])

  switch (state.kind) {
    case 'loading':
      return (
        <p className="center muted" role="status">
          Loading…
        </p>
      )
    case 'config-error':
      return (
        <main className="center card" role="alert">
          <h1>App not configured</h1>
          <p>{state.message}</p>
        </main>
      )
    case 'signed-out':
      return <SignIn linkError={state.linkError} />
    case 'signed-in':
      return <>{children(state.session)}</>
  }
}
