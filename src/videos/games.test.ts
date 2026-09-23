import type { Game } from '../data/types'
import { defaultSide, endGame, gameRange, setBoundary, sortGames, startGame, validateGames, type NewGameInput } from './games'

let seq = 0
function g(start_s: number, end_s: number | null, extra: Partial<Game> = {}): Game {
  seq++
  return {
    id: `g${seq}`,
    user_id: 'u',
    video_id: 'v',
    start_s,
    end_s,
    my_side: 'left',
    format: 'singles',
    opponent: null,
    my_score: null,
    opp_score: null,
    notes: null,
    created_at: `2026-09-24T00:00:${String(seq).padStart(2, '0')}Z`,
    updated_at: '2026-09-24T00:00:00Z',
    ...extra,
  }
}

const input = (extra: Partial<NewGameInput> = {}): NewGameInput => ({
  id: 'new',
  userId: 'u',
  videoId: 'v',
  now: '2026-09-24T12:00:00Z',
  side: 'left',
  ...extra,
})

describe('startGame (B)', () => {
  it('starts the first game when a side is chosen', () => {
    const plan = startGame([], 12.5, input({ side: 'right' }), 600)
    expect(plan).toMatchObject({ ok: true, message: 'Started Game 1 at 0:12.5.' })
    if (!plan.ok) throw new Error()
    expect(plan.save).toEqual([expect.objectContaining({ id: 'new', start_s: 12.5, end_s: null, my_side: 'right' })])
  })

  it('refuses the first game without a side (my_side is required)', () => {
    expect(startGame([], 10, input({ side: null }), 600)).toMatchObject({ ok: false, message: /Choose which side/ })
  })

  it('closes the open game at the same time first (GAM-1)', () => {
    const open = g(10, null)
    const plan = startGame([open], 300, input(), 600)
    expect(plan).toMatchObject({ ok: true, message: 'Ended Game 1 and started Game 2 at 5:00.0.' })
    if (!plan.ok) throw new Error()
    expect(plan.save).toEqual([
      expect.objectContaining({ id: open.id, end_s: 300 }),
      expect.objectContaining({ id: 'new', start_s: 300, end_s: null }),
    ])
  })

  it('copies the format of the previous game', () => {
    const plan = startGame([g(10, 100, { format: 'doubles' })], 200, input(), 600)
    if (!plan.ok) throw new Error(plan.message)
    expect(plan.save.at(-1)?.format).toBe('doubles')
  })

  it('refuses a start inside another game (GAM-4)', () => {
    expect(startGame([g(10, 100)], 50, input(), 600)).toMatchObject({ ok: false, message: /inside Game 1 \(0:10.0–1:40.0\)/ })
  })

  it('allows a start exactly where the previous game ended', () => {
    expect(startGame([g(10, 100)], 100, input(), 600).ok).toBe(true)
  })

  it('refuses when the open game starts after this time', () => {
    expect(startGame([g(200, null)], 100, input(), 600)).toMatchObject({ ok: false, message: /still open.*End it with E/ })
  })

  it('refuses to close the open game across a later game', () => {
    const games = [g(10, null), g(100, 200)]
    expect(startGame(games, 250, input(), 600)).toMatchObject({ ok: false, message: /would overlap/ })
  })

  it('allows an earlier game before existing later games', () => {
    const plan = startGame([g(100, 200)], 20, input(), 600)
    expect(plan).toMatchObject({ ok: true, message: 'Started Game 1 at 0:20.0.' })
  })

  it('refuses a start at or after the end of the video', () => {
    expect(startGame([], 600, input(), 600)).toMatchObject({ ok: false, message: /after the end of the video/ })
  })
})

describe('endGame (E)', () => {
  it('ends the open game', () => {
    const open = g(10, null)
    const plan = endGame([open], 95, 'now', 600)
    expect(plan).toMatchObject({ ok: true, message: 'Ended Game 1 at 1:35.0.' })
  })

  it('explains when no game is open', () => {
    expect(endGame([g(10, 20)], 30, 'now', 600)).toMatchObject({ ok: false, message: /No game is open/ })
  })

  it('refuses an end before the start', () => {
    expect(endGame([g(50, null)], 40, 'now', 600)).toMatchObject({ ok: false, message: /before the start of Game 1/ })
  })

  it('refuses an end past the start of the next game', () => {
    expect(endGame([g(10, null), g(100, 200)], 150, 'now', 600)).toMatchObject({ ok: false, message: /would overlap/ })
  })
})

describe('setBoundary', () => {
  it('moves a start and keeps games apart', () => {
    const a = g(10, 100)
    const b = g(150, 300)
    expect(setBoundary([a, b], b.id, 'start', 120, 'now', 600)).toMatchObject({ ok: true, message: 'Game 2 now starts at 2:00.0.' })
    expect(setBoundary([a, b], b.id, 'start', 90, 'now', 600)).toMatchObject({ ok: false, message: /overlap/ })
    expect(setBoundary([a, b], a.id, 'end', 5, 'now', 600)).toMatchObject({ ok: false, message: /end before it starts/ })
  })
})

describe('validateGames', () => {
  it('allows only one open game', () => {
    expect(validateGames([g(10, null), g(100, null)], null)).toMatch(/Only one game can be open/)
  })

  it('accepts touching games', () => {
    expect(validateGames([g(0, 100), g(100, 200)], 600)).toBeNull()
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
