import { authErrorFromUrl, redirectUrl } from './auth'

describe('redirectUrl', () => {
  it('drops hash and query', () => {
    expect(redirectUrl({ origin: 'https://dejvicek.github.io', pathname: '/foosball-tagger/' })).toBe(
      'https://dejvicek.github.io/foosball-tagger/',
    )
  })
})

describe('authErrorFromUrl', () => {
  it('reads the error from the query string', () => {
    expect(
      authErrorFromUrl('https://x.io/app/?error=access_denied&error_description=Email+link+is+invalid+or+has+expired'),
    ).toBe('Email link is invalid or has expired')
  })

  it('reads the error from the hash', () => {
    expect(authErrorFromUrl('https://x.io/app/#error=access_denied&error_description=expired')).toBe('expired')
  })

  it('returns null without an error', () => {
    expect(authErrorFromUrl('https://x.io/app/#/videos')).toBeNull()
  })
})
