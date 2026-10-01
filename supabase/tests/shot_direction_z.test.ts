// @vitest-environment node
// Migration 0005: shot direction Z/7 renamed Z (ADR-0030).
import type { PGlite } from '@electric-sql/pglite'
import { asAdmin, freshDb, migrate, MIGRATIONS, USER_A } from './db'

let db: PGlite

beforeEach(async () => {
  db = await freshDb('0005')
  await asAdmin(db)
})

it('renames Z/7 to Z and refuses Z/7 afterwards', async () => {
  const v = await db.query<{ id: string }>(`insert into videos (user_id, youtube_id) values ($1, 'dQw4w9WgXcQ') returning id`, [USER_A])
  const g = await db.query<{ id: string }>(`insert into games (user_id, video_id, start_s, my_side) values ($1, $2, 0, 'left') returning id`, [
    USER_A,
    v.rows[0]?.id,
  ])
  const gameId = g.rows[0]?.id
  for (const [start, dir] of [[1, 'Straight'], [2, 'Z/7'], [3, null]] as const) {
    await db.query(`insert into possessions (user_id, game_id, start_s, shot_direction) values ($1, $2, $3, $4)`, [USER_A, gameId, start, dir])
  }

  await migrate(db, MIGRATIONS.find((f) => f.startsWith('0005')) as string)

  const rows = await db.query<{ shot_direction: string | null }>(`select shot_direction from possessions order by start_s`)
  expect(rows.rows.map((r) => r.shot_direction)).toEqual(['Straight', 'Z', null])
  await expect(db.query(`insert into possessions (user_id, game_id, shot_direction) values ($1, $2, 'Z/7')`, [USER_A, gameId])).rejects.toThrow(
    /check constraint/,
  )
})
