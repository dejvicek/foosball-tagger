import { fireEvent, render, screen } from '@testing-library/react'
import { SignIn } from './SignIn'
import { signInWithGitHub } from '../data/auth'

vi.mock('../data/auth', () => ({
  sendMagicLink: vi.fn<() => Promise<void>>(),
  signInWithGitHub: vi.fn<() => Promise<void>>(),
}))

describe('SignIn', () => {
  it('starts GitHub sign-in', () => {
    vi.mocked(signInWithGitHub).mockReturnValue(new Promise(() => {}))
    render(<SignIn linkError={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))
    expect(signInWithGitHub).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Opening GitHub…' })).toBeDisabled()
  })

  it('explains a GitHub sign-in that could not start', async () => {
    vi.mocked(signInWithGitHub).mockRejectedValue(new Error('Unsupported provider: provider is not enabled'))
    render(<SignIn linkError={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with GitHub' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not start GitHub sign-in: Unsupported provider: provider is not enabled',
    )
    expect(screen.getByRole('button', { name: 'Sign in with GitHub' })).toBeEnabled()
  })

  it('shows an error returned in the redirect URL', () => {
    render(<SignIn linkError="access_denied" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in did not complete (access_denied)')
  })
})
