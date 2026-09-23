// @vitest-environment node
// Row Level Security and constraints of the schema (PRD §5, ADR-0002, ADR-0009, ADR-0013).
import type { PGlite } from '@electric-sql/pglite'
import { as, asAdmin, freshDb, USER_A, USER_B } from './db'

let db: PGlite

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<T>(sql, params)
  if (rows.length !== 1) throw new Error(`expected one row, got ${rows.length}: ${sql}`)
  return rows[0] as T
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  return (await db.query(sql, params)).rows.length
}

/** Creates a video and a game owned by `user`; returns their ids. */
async function videoWithGame(user: string, youtubeId = 'dQw4w9WgXcQ') {
  await as(db, user)
  const v = await one<{ id: string }>(`insert into videos (youtube_id) values ($1) returning id`, [youtubeId])
  const g = await one<{ id: string }>(
    `insert into games (video_id, start_s, my_side) values ($1, 10, 'left') returning id`,
    [v.id],
  )
  return { videoId: v.id, gameId: g.id }
}

beforeEach(async () => {
  db = await freshDb()
})

describe('ownership', () => {
  it('fills user_id from the session', async () => {
    const { videoId } = await videoWithGame(USER_A)
    const v = await one<{ user_id: string }>(`select user_id from videos where id = $1`, [videoId])
    expect(v.user_id).toBe(USER_A)
  })

  it('hides, and refuses to change or delete, another user’s rows', async () => {
    const { videoId, gameId } = await videoWithGame(USER_A)
    await as(db, USER_B)
    expect(await count(`select 1 from videos`)).toBe(0)
    expect(await count(`select 1 from games`)).toBe(0)
    expect(await count(`select 1 from video_summaries`)).toBe(0)
    expect(await count(`update videos set title = 'x' where id = $1 returning 1`, [videoId])).toBe(0)
    expect(await count(`update games set notes = 'x' where id = $1 returning 1`, [gameId])).toBe(0)
    expect(await count(`delete from videos where id = $1 returning 1`, [videoId])).toBe(0)
    await asAdmin(db)
    expect(await count(`select 1 from videos where id = $1 and title is null`, [videoId])).toBe(1)
  })

  it('refuses rows created in another user’s name', async () => {
    await as(db, USER_B)
    await expect(db.query(`insert into videos (user_id, youtube_id) values ($1, 'dQw4w9WgXcQ')`, [USER_A])).rejects.toThrow(
      /row-level security/,
    )
  })

  it('refuses to hand a row over to another user', async () => {
    const { videoId } = await videoWithGame(USER_A)
    await expect(db.query(`update videos set user_id = $1 where id = $2`, [USER_B, videoId])).rejects.toThrow(
      /row-level security/,
    )
  })

  it('lets two users add the same YouTube video, but not one user twice', async () => {
    await videoWithGame(USER_A)
    await videoWithGame(USER_B)
    await expect(db.query(`insert into videos (youtube_id) values ('dQw4w9WgXcQ')`)).rejects.toThrow(/unique/)
  })

  it('gives anon nothing', async () => {
    await videoWithGame(USER_A)
    await as(db, 'anon')
    await expect(db.query(`select * from videos`)).rejects.toThrow(/permission denied/)
    await expect(db.query(`select * from video_summaries`)).rejects.toThrow(/permission denied/)
  })
})

describe('child rows check the parent owner (ADR-0009)', () => {
  it('refuses a game on another user’s video', async () => {
    const a = await videoWithGame(USER_A)
    await as(db, USER_B)
    await expect(
      db.query(`insert into games (video_id, start_s, my_side) values ($1, 0, 'left')`, [a.videoId]),
    ).rejects.toThrow(/row-level security/)
  })

  it('refuses moving an own game onto another user’s video', async () => {
    const a = await videoWithGame(USER_A)
    const b = await videoWithGame(USER_B, 'aaaaaaaaaaa')
    await expect(db.query(`update games set video_id = $1 where id = $2`, [a.videoId, b.gameId])).rejects.toThrow(
      /row-level security/,
    )
  })

  it('refuses a possession in another user’s game', async () => {
    const a = await videoWithGame(USER_A)
    await as(db, USER_B)
    await expect(db.query(`insert into possessions (game_id, start_s) values ($1, 12)`, [a.gameId])).rejects.toThrow(
      /row-level security/,
    )
  })

  it('refuses a calibration or job naming a game from a different video', async () => {
    const first = await videoWithGame(USER_A)
    const second = await videoWithGame(USER_A, 'bbbbbbbbbbb')
    const points = JSON.stringify([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])
    await expect(
      db.query(`insert into calibrations (video_id, game_id, points) values ($1, $2, $3)`, [first.videoId, second.gameId, points]),
    ).rejects.toThrow(/row-level security/)
    await expect(
      db.query(`insert into analysis_jobs (video_id, game_id) values ($1, $2)`, [first.videoId, second.gameId]),
    ).rejects.toThrow(/row-level security/)
    await db.query(`insert into calibrations (video_id, game_id, points) values ($1, $2, $3)`, [first.videoId, first.gameId, points])
    await db.query(`insert into analysis_jobs (video_id) values ($1)`, [first.videoId])
  })
})

describe('constraints', () => {
  it('allows a blank setup (ADR-0002)', async () => {
    const { gameId } = await videoWithGame(USER_A)
    const p = await one<{ setup: string | null }>(`insert into possessions (game_id) values ($1) returning setup`, [gameId])
    expect(p.setup).toBeNull()
  })

  it('refuses tags on a No shot possession', async () => {
    const { gameId } = await videoWithGame(USER_A)
    await expect(
      db.query(`insert into possessions (game_id, shot_type, result) values ($1, 'No shot', 'Goal')`, [gameId]),
    ).rejects.toThrow(/check constraint/)
    await db.query(`insert into possessions (game_id, shot_type, setup) values ($1, 'No shot', 'Middle')`, [gameId])
  })

  it('refuses a shot before the start, and an unknown category value', async () => {
    const { gameId } = await videoWithGame(USER_A)
    await expect(db.query(`insert into possessions (game_id, start_s, shot_s) values ($1, 20, 19)`, [gameId])).rejects.toThrow(
      /check constraint/,
    )
    await expect(db.query(`insert into possessions (game_id, hole) values ($1, 'Long')`, [gameId])).rejects.toThrow(
      /check constraint/,
    )
  })

  it('refuses a malformed YouTube id', async () => {
    await as(db, USER_A)
    await expect(db.query(`insert into videos (youtube_id) values ('https://youtu.be/x')`)).rejects.toThrow(/check constraint/)
  })

  it('bumps updated_at on update', async () => {
    const { videoId } = await videoWithGame(USER_A)
    await asAdmin(db)
    await db.query(`update videos set updated_at = now() - interval '1 day' where id = $1`, [videoId])
    await as(db, USER_A)
    const v = await one<{ fresh: boolean }>(
      `update videos set title = 'x' where id = $1 returning updated_at > now() - interval '1 minute' as fresh`,
      [videoId],
    )
    expect(v.fresh).toBe(true)
  })
})

describe('video_summaries and delete cascade', () => {
  it('counts games, confirmed possessions and running jobs; delete removes everything', async () => {
    const { videoId, gameId } = await videoWithGame(USER_A)
    await db.query(
      `insert into possessions (game_id, start_s, source, review_status) values
         ($1, 11, 'manual', 'confirmed'), ($1, 20, 'manual', 'confirmed'),
         ($1, 30, 'auto', 'unreviewed'), ($1, 40, 'auto', 'rejected')`,
      [gameId],
    )
    await db.query(`insert into analysis_jobs (video_id, status) values ($1, 'analyzing')`, [videoId])
    const s = await one<Record<string, unknown>>(`select * from video_summaries where id = $1`, [videoId])
    expect(s).toMatchObject({
      game_count: 1,
      confirmed_possession_count: 2,
      possession_count: 4,
      calibration_count: 0,
      job_count: 1,
      job_running: true,
    })

    await db.query(`delete from videos where id = $1`, [videoId])
    await asAdmin(db)
    for (const table of ['games', 'possessions', 'analysis_jobs']) {
      expect(await count(`select 1 from ${table}`)).toBe(0)
    }
  })
})
