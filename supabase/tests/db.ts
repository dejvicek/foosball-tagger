import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const dir = join(import.meta.dirname, '..')

export const USER_A = '00000000-0000-4000-8000-00000000000a'
export const USER_B = '00000000-0000-4000-8000-00000000000b'

export const MIGRATIONS = readdirSync(join(dir, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort()

export async function migrate(db: PGlite, file: string): Promise<void> {
  await db.exec(readFileSync(join(dir, 'migrations', file), 'utf8'))
}

/**
 * A fresh database with the Supabase stubs, the migrations applied, and two users.
 * `before` stops ahead of the migration whose file name starts with it (to test a data migration).
 */
export async function freshDb(before?: string): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(readFileSync(join(dir, 'tests/supabase-stub.sql'), 'utf8'))
  for (const file of MIGRATIONS) {
    if (before && file >= before) break
    await migrate(db, file)
  }
  await db.exec(`insert into auth.users (id, email) values ('${USER_A}', 'a@example.com'), ('${USER_B}', 'b@example.com')`)
  return db
}

/** Switches the session to a signed-in user (or anon), as PostgREST does per request. */
export async function as(db: PGlite, user: string | 'anon'): Promise<void> {
  await db.exec('reset role')
  if (user === 'anon') {
    await db.query(`select set_config('request.jwt.claims', '', false)`)
    await db.exec('set role anon')
  } else {
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user, role: 'authenticated' })])
    await db.exec('set role authenticated')
  }
}

/** Runs a query as superuser, bypassing RLS, for setup and assertions. */
export async function asAdmin(db: PGlite): Promise<void> {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claims', '', false)`)
}
