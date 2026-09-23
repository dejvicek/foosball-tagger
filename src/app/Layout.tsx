import { useState } from 'react'
import { Link, Outlet } from 'react-router'
import { signOut } from '../data/auth'

export function Layout({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null)

  async function onSignOut() {
    try {
      await signOut()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="wrap">
      <header className="top">
        <h1>
          <Link to="/">Session tagger</Link>
        </h1>
        <span className="muted spacer">{email}</span>
        <button className="btn" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </header>
      {error && (
        <p className="error" role="alert">
          Sign-out failed: {error}
        </p>
      )}
      <Outlet />
    </div>
  )
}
