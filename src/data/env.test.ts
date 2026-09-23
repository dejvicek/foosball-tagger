import { EnvError, readEnv } from './env'

describe('readEnv', () => {
  it('returns trimmed values', () => {
    expect(
      readEnv({ VITE_SUPABASE_URL: ' https://x.supabase.co ', VITE_SUPABASE_ANON_KEY: 'key' }),
    ).toEqual({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'key' })
  })

  it('names every missing variable', () => {
    expect(() => readEnv({})).toThrow(/VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY/)
    expect(() => readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toThrow(EnvError)
  })

  it('rejects a value that is not a URL', () => {
    expect(() =>
      readEnv({ VITE_SUPABASE_URL: 'x.supabase.co', VITE_SUPABASE_ANON_KEY: 'key' }),
    ).toThrow(/not a URL/)
  })
})
