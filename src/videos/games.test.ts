import type { Game, Match } from '../data/types'
import { defaultSide, endGame, gameRange, setBoundary, sortGames, startGame, startMatch, validateGames, type NewGameInput } from './games'

let seq = 0
function g(start_s: number, end_s: number | null, extra: Partial<Game> = {}): Game {
  seq++
  return {
    id: `g${seq}`,
    user_id: 'u',
    video_id: 'v',
    match_id: 'm1',
    start_s,
    end_s,
    my_side: 'left',
    my_score: null,
    opp_score: null,
    notes: null,
    created_at: `2026-09-24T00:00:${String(seq).padStart(2, '0')}Z`,
    updated_at: '2026-09-24T00:00:00Z',
    ...extra,
  }
}

const M1: Match = {
  id: 'm1',
  user_id: 'u',
  video_id: 'v',
  best_of: null,
  format: 'singles',
  teammate: null,
  opponent: null,
  opponent2: null,
  notes: null,
  created_at: '2026-09-24T00:00:00Z',
  updated_at: '2026-09-24T00:00:00Z',
}
const ms = [M1]

const input = (extra: Partial<NewGameInput> = {}): NewGameInput => ({
  id: 'new',
  userId: 'u',
  videoId: 'v',
  now: '2026-09-24T12:00:00Z',
  side: 'left',
  matchId: 'm1',
  ...extra,
})

describe('startGame (B)', () => {
  it('starts the first game when a side is chosen', () => {
    const plan = startGame([], ms, 12.5, input({ side: 'right' }), 600)
    expect(plan).toMatchObject({ ok: true, message: 'Started Match 1 · Game 1 at 0:12.5.' })
    if (!plan.ok) throw new Error()
    expect(plan.save).toEqual([expect.objectContaining({ id: 'new', start_s: 12.5, end_s: null, my_side: 'right' })])
  })

  it('refuses the first game without a side (my_side is required)', () => {
    expect(startGame([], ms, 10, input({ side: null }), 600)).toMatchObject({ ok: false, message: /Choose which side/ })
  })

  it('closes the open game at the same time first (GAM-1)', () => {
    const open = g(10, null)
    const plan = startGame([open], ms, 300, input(), 600)
    expect(plan).toMatchObject({ ok: true, message: 'Ended Match 1 · Game 1 and started Match 1 · Game 2 at 5:00.0.' })
    if (!plan.ok) throw new Error()
    expect(plan.save).toEqual([
      expect.objectContaining({ id: open.id, end_s: 300 }),
      expect.objectContaining({ id: 'new', start_s: 300, end_s: null }),
    ])
  })

  it('refuses a start inside another game (GAM-4)', () => {
    expect(startGame([g(10, 100)], ms, 50, input(), 600)).toMatchObject({ ok: false, message: /inside Match 1 · Game 1 \(0:10.0–1:40.0\)/ })
  })

  it('allows a start exactly where the previous game ended', () => {
    expect(startGame([g(10, 100)], ms, 100, input(), 600).ok).toBe(true)
  })

  it('refuses when the open game starts after this time', () => {
    expect(startGame([g(200, null)], ms, 100, input(), 600)).toMatchObject({ ok: false, message: /still open.*End it with E/ })
  })

  it('refuses to close the open game across a later game', () => {
    const games = [g(10, null), g(100, 200)]
    expect(startGame(games, ms, 250, input(), 600)).toMatchObject({ ok: false, message: /would overlap/ })
  })

  it('allows an earlier game before existing later games', () => {
    const plan = startGame([g(100, 200)], ms, 20, input(), 600)
    expect(plan).toMatchObject({ ok: true, message: 'Started Match 1 · Game 1 at 0:20.0.' })
  })

  it('refuses a start at or after the end of the video', () => {
    expect(startGame([], ms, 600, input(), 600)).toMatchObject({ ok: false, message: /after the end of the video/ })
  })
})

describe('endGame (E)', () => {
  it('ends the open game', () => {
    const open = g(10, null)
    const plan = endGame([open], ms, 95, 'now', 600)
    expect(plan).toMatchObject({ ok: true, message: 'Ended Match 1 · Game 1 at 1:35.0.' })
  })

  it('explains when no game is open', () => {
    expect(endGame([g(10, 20)], ms, 30, 'now', 600)).toMatchObject({ ok: false, message: /No game is open/ })
  })

  it('refuses an end before the start', () => {
    expect(endGame([g(50, null)], ms, 40, 'now', 600)).toMatchObject({ ok: false, message: /before the start of Match 1 · Game 1/ })
  })

  it('refuses an end past the start of the next game', () => {
    expect(endGame([g(10, null), g(100, 200)], ms, 150, 'now', 600)).toMatchObject({ ok: false, message: /would overlap/ })
  })
})

describe('setBoundary', () => {
  it('moves a start and keeps games apart', () => {
    const a = g(10, 100)
    const b = g(150, 300)
    expect(setBoundary([a, b], ms, b.id, 'start', 120, 'now', 600)).toMatchObject({ ok: true, message: 'Match 1 · Game 2 now starts at 2:00.0.' })
    expect(setBoundary([a, b], ms, b.id, 'start', 90, 'now', 600)).toMatchObject({ ok: false, message: /overlap/ })
    expect(setBoundary([a, b], ms, a.id, 'end', 5, 'now', 600)).toMatchObject({ ok: false, message: /end before it starts/ })
  })
})

describe('validateGames', () => {
  it('allows only one open game', () => {
    expect(validateGames([g(10, null), g(100, null)], ms, null)).toMatch(/Only one game can be open/)
  })

  it('accepts touching games', () => {
    expect(validateGames([g(0, 100), g(100, 200)], ms, 600)).toBeNull()
  })
})

describe('gameRange', () => {
  it('bounds an open game by the next game, else the video', () => {
    const open = g(10, null)
    const later = g(100, 200)
    expect(gameRange(open, [open, later], 600)).toEqual({ start: 10, end: 100 })
    expect(gameRange(later, [open, later], 600)).toEqual({ start: 100, end: 200 })
    expect(gameRange(open, [open], 600)).toEqual({ start: 10, end: 600 })
    expect(gameRange(open, [open], null).end).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('defaultSide', () => {
  it('uses the previous game on the video, else the latest', () => {
    const games = [g(10, 100, { my_side: 'left' }), g(200, 300, { my_side: 'right' })]
    expect(defaultSide(games, 150)).toBe('left')
    expect(defaultSide(games, 400)).toBe('right')
    expect(defaultSide(games, 5)).toBe('right')
    expect(defaultSide([], 5)).toBeNull()
  })

  it('sorts by start time', () => {
    const late = g(200, 300)
    const early = g(10, 100)
    expect(sortGames([late, early]).map((x) => x.id)).toEqual([early.id, late.id])
  })
})

describe('matches (ADR-0040)', () => {
  const M2: Match = { ...M1, id: 'm2', created_at: '2026-09-24T00:00:09Z' }

  it('starts the game in the given match and says when it passes best_of', () => {
    const one = { ...M1, best_of: 1 }
    const plan = startGame([g(0, 10)], [one], 20, input(), 600)
    expect(plan).toMatchObject({ ok: true, message: 'Started Match 1 · Game 2 at 0:20.0. BO1 already had 1 game.' })
    if (!plan.ok) throw new Error()
    expect(plan.save.at(-1)).toMatchObject({ match_id: 'm1', start_s: 20 })
    expect(plan.save.at(-1)).not.toHaveProperty('format')
  })

  it('refuses a game in an earlier match after a later match’s games', () => {
    const games = [g(0, 10), g(10, 20, { match_id: 'm2' })]
    const plan = startGame(games, [M1, M2], 30, input({ matchId: 'm1' }), 600)
    expect(plan).toEqual({
      ok: false,
      message: 'Match 1 and Match 2 would interleave at 0:30.0. A match’s games follow each other: start a new match with M, or select the match being played.',
    })
  })
})

describe('startMatch (M)', () => {
  const now = '2026-09-24T12:00:00Z'
  const mi = { id: 'mNew', userId: 'u', videoId: 'v', now }

  it('creates an empty match copying the current one', () => {
    const plan = startMatch([g(0, 10)], [{ ...M1, opponent: 'Tom', best_of: 3 }], 50, mi, null, 600)
    expect(plan).toMatchObject({ ok: true, save: [], message: 'Started Match 2. Press B where its first game starts.' })
    if (!plan.ok) throw new Error()
    expect(plan.match).toMatchObject({ id: 'mNew', opponent: 'Tom', best_of: 3, notes: null })
  })

  it('ends an open game first', () => {
    const plan = startMatch([g(0, null)], [M1], 50, mi, null, 600)
    expect(plan).toMatchObject({ ok: true, message: 'Ended Match 1 · Game 1 at 0:50.0. Started Match 2. Press B where its first game starts.' })
    if (!plan.ok) throw new Error()
    expect(plan.save).toEqual([expect.objectContaining({ end_s: 50 })])
  })

  it('refuses when the open game starts after this time', () => {
    expect(startMatch([g(60, null)], [M1], 50, mi, null, 600)).toMatchObject({ ok: false })
  })
})
