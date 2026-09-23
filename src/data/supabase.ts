import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readEnv } from './env'

let client: SupabaseClient | null = null

/**
 * The single Supabase client. Created lazily so a missing env config surfaces
 * as a readable error screen instead of a blank page.
 *
 * PKCE flow: the magic link returns `?code=` in the query string, which does not
 * collide with hash routing (ADR-0004).
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const env = readEnv(import.meta.env)
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    })
  }
  return client
}
