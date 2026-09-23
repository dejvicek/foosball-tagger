import type { Session } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

/** Where the magic link sends the browser back to: the app root, without hash or query. */
export function redirectUrl(location: Pick<Location, 'origin' | 'pathname'>): string {
  return location.origin + location.pathname
}

export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectUrl(window.location), shouldCreateUser: true },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw error
}

/**
 * Calls `onChange` with the current session and on every change.
 * Returns an unsubscribe function.
 */
export function watchSession(onChange: (session: Session | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    onChange(session)
  })
  return () => data.subscription.unsubscribe()
}

/** Removes `?code=` (or an auth error) from the address bar once Supabase has consumed it. */
export function cleanAuthParams(): void {
  const url = new URL(window.location.href)
  const keys = ['code', 'error', 'error_code', 'error_description']
  if (!keys.some((k) => url.searchParams.has(k))) return
  keys.forEach((k) => url.searchParams.delete(k))
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}

/** Reads an auth error that Supabase put in the redirect URL, e.g. an expired link. */
export function authErrorFromUrl(href: string): string | null {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.replace(/^#\/?/, ''))
  return url.searchParams.get('error_description') ?? hash.get('error_description')
}
