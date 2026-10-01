// @vitest-environment node
// Migration 0004: shot direction, existing shots Straight (ADR-0028).
import type { PGlite } from '@electric-sql/pglite'
import { asAdmin, freshDb, migrate, MIGRATIONS, USER_A } from './db'

let db: PGlite

beforeEach(async () => {
  db = await freshDb('0004')
  await asAdmin(db)
})

it('marks existing shots Straight, leaves No shot blank, and keeps No shot free of a shot direction', async () => {
  const v = await db.query<{ id: string }>(`insert into videos (user_id, youtube_id) values ($1, 'dQw4w9WgXcQ') returning id`, [USER_A])
  const g = await db.query<{ id: string }>(`insert into games (user_id, video_id, start_s, my_side) values ($1, $2, 0, 'left') returning id`, [
    USER_A,
    v.rows[0]?.id,
  ])
  const gameId = g.rows[0]?.id
  for (const [start, type] of [[1, 'Pin'], [2, 'No shot'], [3, null]] as const) {
    await db.query(`insert into possessions (user_id, game_id, start_s, shot_type) values ($1, $2, $3, $4)`, [USER_A, gameId, start, type])
  }

  await migrate(db, MIGRATIONS.find((f) => f.startsWith('0004')) as string)

  const rows = await db.query<{ shot_direction: string | null }>(`select shot_direction from possessions order by start_s`)
  expect(rows.rows.map((r) => r.shot_direction)).toEqual(['Straight', null, 'Straight'])
  await db.query(`insert into possessions (user_id, game_id, shot_direction) values ($1, $2, 'Z/7')`, [USER_A, gameId])
  await expect(db.query(`insert into possessions (user_id, game_id, shot_direction) values ($1, $2, 'Bank')`, [USER_A, gameId])).rejects.toThrow(
    /check constraint/,
  )
  await expect(
    db.query(`insert into possessions (user_id, game_id, shot_type, shot_direction) values ($1, $2, 'No shot', 'Straight')`, [USER_A, gameId]),
  ).rejects.toThrow(/check constraint/)
})
