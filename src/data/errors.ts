/** An error whose message can be shown to the user as is. */
export class DataError extends Error {
  override name = 'DataError'
  constructor(
    message: string,
    readonly code: string | null = null,
  ) {
    super(message)
  }
}

interface PostgrestLike {
  message?: unknown
  code?: unknown
}

/** Turns a Supabase/PostgREST or network error into a readable DataError. */
export function toDataError(err: unknown, action: string): DataError {
  if (err instanceof DataError) return err
  const e = (typeof err === 'object' && err !== null ? err : {}) as PostgrestLike
  const code = typeof e.code === 'string' ? e.code : null
  const message = typeof e.message === 'string' ? e.message : String(err)

  if (code === 'PGRST205' || code === '42P01') {
    return new DataError(
      `Could not ${action}: the database tables are missing. Apply the migrations with “npx supabase db push”.`,
      code,
    )
  }
  if (code === '42501') return new DataError(`Could not ${action}: permission denied. Try signing out and in again.`, code)
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return new DataError(`Could not ${action}: you seem to be offline, or Supabase is unreachable.`, code)
  }
  return new DataError(`Could not ${action}: ${message}`, code)
}
