import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readEnv } from './env'
import type { Database } from './types'

export type Client = SupabaseClient<Database>

let client: Client | null = null

/**
 * The single Supabase client. Created lazily so a missing env config surfaces
 * as a readable error screen instead of a blank page.
 *
 * PKCE flow: the magic link returns `?code=` in the query string, which does not
 * collide with hash routing (ADR-0004).
 */
export function getSupabase(): Client {
  if (!client) {
    const env = readEnv(import.meta.env)
    client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    })
  }
  return client
}
