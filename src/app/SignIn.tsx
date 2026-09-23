import { useState, type FormEvent } from 'react'
import { sendMagicLink, signInWithGitHub } from '../data/auth'

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'redirecting' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string }

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/rate limit|too many/i.test(message)) {
    return 'Too many sign-in emails were requested. Wait a few minutes and try again.'
  }
  return message
}

export function SignIn({ linkError }: { linkError: string | null }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const address = email.trim()
    if (!address) return
    setStatus({ kind: 'sending' })
    try {
      await sendMagicLink(address)
      setStatus({ kind: 'sent', email: address })
    } catch (err) {
      setStatus({ kind: 'error', message: `Could not send the sign-in link: ${describeError(err)}` })
    }
  }

  async function onGitHub() {
    setStatus({ kind: 'redirecting' })
    try {
      await signInWithGitHub()
    } catch (err) {
      setStatus({ kind: 'error', message: `Could not start GitHub sign-in: ${describeError(err)}` })
    }
  }

  const busy = status.kind === 'sending' || status.kind === 'redirecting'

  return (
    <main className="center card">
      <h1>Session tagger</h1>
      {status.kind === 'sent' ? (
        <div role="status">
          <p>
            Sign-in link sent to <strong>{status.email}</strong>.
          </p>
          <p className="muted">
            Open it in <strong>this browser</strong>. A link opened in another browser or app will not
            sign you in here.
          </p>
          <button className="btn" type="button" onClick={() => setStatus({ kind: 'idle' })}>
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          {linkError && (
            <p className="error" role="alert">
              Sign-in did not complete ({linkError}). Try again.
            </p>
          )}
          <button className="btn wide" type="button" onClick={onGitHub} disabled={busy}>
            {status.kind === 'redirecting' ? 'Opening GitHub…' : 'Sign in with GitHub'}
          </button>
          <p className="divider muted">or get a link by email</p>
          <label htmlFor="email">Email</label>
          <div className="row">
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn primary" type="submit" disabled={busy}>
              {status.kind === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
          </div>
          {status.kind === 'error' && (
            <p className="error" role="alert">
              {status.message}
            </p>
          )}
        </form>
      )}
    </main>
  )
}
