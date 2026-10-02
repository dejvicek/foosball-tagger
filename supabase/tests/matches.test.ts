// @vitest-environment node
// Migration 0006: matches between videos and games (ADR-0040).
import type { PGlite } from '@electric-sql/pglite'
import { as, asAdmin, freshDb, migrate, MIGRATIONS, USER_A, USER_B } from './db'

let db: PGlite

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<T>(sql, params)
  if (rows.length !== 1) throw new Error(`expected one row, got ${rows.length}: ${sql}`)
  return rows[0] as T
}

describe('data migration', () => {
  beforeEach(async () => {
    db = await freshDb('0006')
    await asAdmin(db)
  })

  it('puts every existing game in its own BO1 match with the game’s players', async () => {
    const v = await one<{ id: string }>(`insert into videos (user_id, youtube_id) values ($1, 'dQw4w9WgXcQ') returning id`, [USER_A])
    await db.query(
      `insert into games (user_id, video_id, start_s, my_side, format, opponent, notes) values ($1, $2, 0, 'left', 'singles', 'Tom', 'g1 notes')`,
      [USER_A, v.id],
    )
    await db.query(
      `insert into games (user_id, video_id, start_s, my_side, format, teammate, opponent, opponent2) values ($1, $2, 100, 'right', 'doubles', 'Eva', 'Olaf', 'Ida')`,
      [USER_A, v.id],
    )

    await migrate(db, MIGRATIONS.find((f) => f.startsWith('0006')) as string)

    const rows = (
      await db.query<Record<string, unknown>>(
        `select g.start_s::float as start_s, g.notes as game_notes, m.best_of, m.format, m.teammate, m.opponent, m.opponent2, m.notes as match_notes,
                m.user_id = g.user_id as same_user, m.video_id = g.video_id as same_video
           from games g join matches m on m.id = g.match_id order by g.start_s`,
      )
    ).rows
    expect(rows).toEqual([
      { start_s: 0, game_notes: 'g1 notes', best_of: 1, format: 'singles', teammate: null, opponent: 'Tom', opponent2: null, match_notes: null, same_user: true, same_video: true },
      { start_s: 100, game_notes: null, best_of: 1, format: 'doubles', teammate: 'Eva', opponent: 'Olaf', opponent2: 'Ida', match_notes: null, same_user: true, same_video: true },
    ])
    const cols = await db.query(
      `select column_name from information_schema.columns where table_name = 'games' and column_name in ('format','opponent','teammate','opponent2')`,
    )
    expect(cols.rows).toHaveLength(0)
  })
})

describe('matches schema', () => {
  beforeEach(async () => {
    db = await freshDb()
  })

  async function videoWithMatch(user: string, youtubeId = 'dQw4w9WgXcQ') {
    await as(db, user)
    const v = await one<{ id: string }>(`insert into videos (youtube_id) values ($1) returning id`, [youtubeId])
    const m = await one<{ id: string }>(`insert into matches (video_id) values ($1) returning id`, [v.id])
    return { videoId: v.id, matchId: m.id }
  }

  it('allows an empty match and any best_of ≥ 1, even ones', async () => {
    const { matchId } = await videoWithMatch(USER_A)
    for (const b of [1, 2, 5, 9]) await db.query(`update matches set best_of = $1 where id = $2`, [b, matchId])
    await db.query(`update matches set best_of = null where id = $1`, [matchId])
    await expect(db.query(`update matches set best_of = 0 where id = $1`, [matchId])).rejects.toThrow(/check constraint/)
  })

  it('keeps a teammate and second opponent for doubles only (ADR-0023)', async () => {
    const { matchId } = await videoWithMatch(USER_A)
    await expect(db.query(`update matches set teammate = 'Eva' where id = $1`, [matchId])).rejects.toThrow(/check constraint/)
    await db.query(`update matches set format = 'doubles', teammate = 'Eva', opponent2 = 'Olaf' where id = $1`, [matchId])
  })

  it('refuses a game whose match is on another video', async () => {
    const a = await videoWithMatch(USER_A)
    const other = await one<{ id: string }>(`insert into videos (youtube_id) values ('aaaaaaaaaaa') returning id`)
    await expect(
      db.query(`insert into games (video_id, match_id, start_s, my_side) values ($1, $2, 0, 'left')`, [other.id, a.matchId]),
    ).rejects.toThrow(/foreign key/)
  })

  it('hides another user’s matches and refuses games in them', async () => {
    const a = await videoWithMatch(USER_A)
    const b = await videoWithMatch(USER_B, 'bbbbbbbbbbb')
    expect((await db.query(`select 1 from matches`)).rows).toHaveLength(1)
    await expect(
      db.query(`insert into matches (video_id) values ($1)`, [a.videoId]),
    ).rejects.toThrow(/row-level security/)
    await expect(
      db.query(`insert into games (video_id, match_id, start_s, my_side) values ($1, $2, 0, 'left')`, [a.videoId, a.matchId]),
    ).rejects.toThrow(/row-level security/)
    expect(b.matchId).toBeTruthy()
  })

  it('deletes games and possessions with their match; counts matches in video_summaries', async () => {
    const { videoId, matchId } = await videoWithMatch(USER_A)
    await db.query(`insert into matches (video_id) values ($1)`, [videoId])
    const g = await one<{ id: string }>(`insert into games (video_id, match_id, start_s, my_side) values ($1, $2, 0, 'left') returning id`, [videoId, matchId])
    await db.query(`insert into possessions (game_id, start_s) values ($1, 1)`, [g.id])
    expect(await one(`select match_count, game_count from video_summaries where id = $1`, [videoId])).toEqual({ match_count: 2, game_count: 1 })
    await db.query(`delete from matches where id = $1`, [matchId])
    expect((await db.query(`select 1 from games`)).rows).toHaveLength(0)
    expect((await db.query(`select 1 from possessions`)).rows).toHaveLength(0)
  })
})
