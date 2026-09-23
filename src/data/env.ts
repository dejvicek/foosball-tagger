export interface Env {
  supabaseUrl: string
  supabaseAnonKey: string
}

export class EnvError extends Error {
  override name = 'EnvError'
}

/** Reads and validates the build-time Supabase settings. */
export function readEnv(source: {
  VITE_SUPABASE_URL?: string | undefined
  VITE_SUPABASE_ANON_KEY?: string | undefined
}): Env {
  const supabaseUrl = source.VITE_SUPABASE_URL?.trim() ?? ''
  const supabaseAnonKey = source.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
  const missing = [
    supabaseUrl ? null : 'VITE_SUPABASE_URL',
    supabaseAnonKey ? null : 'VITE_SUPABASE_ANON_KEY',
  ].filter((name): name is string => name !== null)
  if (missing.length > 0) {
    throw new EnvError(
      `Missing ${missing.join(' and ')}. Copy .env.example to .env for local development, ` +
        'or add them as GitHub Actions secrets for the deployed build.',
    )
  }
  if (!/^https?:\/\/\S+$/.test(supabaseUrl)) {
    throw new EnvError(`VITE_SUPABASE_URL is not a URL: "${supabaseUrl}".`)
  }
  return { supabaseUrl, supabaseAnonKey }
}
