// @vitest-environment node
// Migration 0003: five holes, direction no longer stored (ADR-0026).
import type { PGlite } from '@electric-sql/pglite'
import { asAdmin, freshDb, migrate, MIGRATIONS, USER_A } from './db'

let db: PGlite

beforeEach(async () => {
  db = await freshDb('0003')
  await asAdmin(db)
})

const holes = async () =>
  (await db.query<{ id: string; hole: string | null }>(`select id::text, hole from possessions order by start_s`)).rows.map((r) => r.hole)

it('clears side-lane holes, renames the middle lane and drops direction', async () => {
  const v = await db.query<{ id: string }>(`insert into videos (user_id, youtube_id) values ($1, 'dQw4w9WgXcQ') returning id`, [USER_A])
  const g = await db.query<{ id: string }>(`insert into games (user_id, video_id, start_s, my_side) values ($1, $2, 0, 'left') returning id`, [
    USER_A,
    v.rows[0]?.id,
  ])
  const gameId = g.rows[0]?.id
  for (const [start, hole] of [[1, 'Pull-side lane'], [2, 'Middle lane'], [3, 'Push-side lane'], [4, null]] as const) {
    await db.query(`insert into possessions (user_id, game_id, start_s, direction, hole) values ($1, $2, $3, 'Pull', $4)`, [USER_A, gameId, start, hole])
  }

  await migrate(db, MIGRATIONS.find((f) => f.startsWith('0003')) as string)

  expect(await holes()).toEqual([null, 'Middle', null, null])
  const cols = await db.query(`select 1 from information_schema.columns where table_name = 'possessions' and column_name = 'direction'`)
  expect(cols.rows).toHaveLength(0)
  await db.query(`insert into possessions (user_id, game_id, hole) values ($1, $2, 'Pull long')`, [USER_A, gameId])
  await expect(db.query(`insert into possessions (user_id, game_id, hole) values ($1, $2, 'Pull-side lane')`, [USER_A, gameId])).rejects.toThrow(
    /check constraint/,
  )
  await expect(
    db.query(`insert into possessions (user_id, game_id, shot_type, hole) values ($1, $2, 'No shot', 'Middle')`, [USER_A, gameId]),
  ).rejects.toThrow(/check constraint/)
})
