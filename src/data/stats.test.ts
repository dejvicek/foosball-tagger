import { scopeItems, videoDate } from './stats'
import type { Game, Match, Possession } from './types'

describe('videoDate', () => {
  it('uses the recorded date, else the day the video was added', () => {
    expect(videoDate({ recorded_on: '2026-09-01', created_at: '2026-09-20T10:00:00Z' })).toBe('2026-09-01')
    expect(videoDate({ recorded_on: null, created_at: '2026-09-20T10:00:00Z' })).toBe('2026-09-20')
  })
})

it('takes format and both doubles opponents from the match', () => {
  const match = { id: 'm1', video_id: 'v1', format: 'doubles', opponent: 'Tom', opponent2: 'Ida', teammate: 'Eva' } as Match
  const game = { id: 'g1', video_id: 'v1', match_id: 'm1' } as Game
  const p = { id: 'p1', game_id: 'g1', review_status: 'confirmed' } as Possession
  const video = { id: 'v1', recorded_on: '2026-09-01', created_at: '2026-09-01T00:00:00Z' }
  const [item] = scopeItems({ videos: [video as never], matches: [match], games: [game], possessions: [p] })
  expect(item).toMatchObject({ matchId: 'm1', format: 'doubles', opponents: ['Tom', 'Ida'] })
})
