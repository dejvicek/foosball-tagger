import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router'
import { signOut } from '../data/auth'
import { SyncStatus } from './SyncStatus'

export function Layout({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null)

  // Buttons marked .nf never take focus on click, so Space and Enter keep their
  // shortcut meaning (TAG-1).
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('.nf')) e.preventDefault()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

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
        <span className="spacer" />
        <SyncStatus />
        <span className="muted">{email}</span>
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
