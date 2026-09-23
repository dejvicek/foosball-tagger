import { act, render, screen } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { AuthGate } from './AuthGate'

let emit: ((session: Session | null) => void) | null = null

vi.mock('../data/auth', () => ({
  authErrorFromUrl: () => null,
  cleanAuthParams: () => {},
  sendMagicLink: vi.fn<() => Promise<void>>(),
  watchSession: (cb: (session: Session | null) => void) => {
    emit = cb
    return () => {
      emit = null
    }
  },
}))

// A partial Session is enough; AuthGate only passes it through.
const fakeSession = { user: { email: 'me@example.com' } } as unknown as Session

function renderGate() {
  return render(<AuthGate>{(s) => <p>Welcome {s.user.email}</p>}</AuthGate>)
}

describe('AuthGate', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'key')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('explains a missing configuration instead of rendering a blank page', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    renderGate()
    expect(screen.getByRole('alert')).toHaveTextContent('Missing VITE_SUPABASE_URL')
  })

  it('shows loading until the session is known', () => {
    renderGate()
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
  })

  it('shows the sign-in form when signed out', () => {
    renderGate()
    act(() => emit?.(null))
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByText(/Welcome/)).not.toBeInTheDocument()
  })

  it('shows the app when signed in, and the form again after sign-out', () => {
    renderGate()
    act(() => emit?.(fakeSession))
    expect(screen.getByText('Welcome me@example.com')).toBeInTheDocument()
    act(() => emit?.(null))
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })
})
