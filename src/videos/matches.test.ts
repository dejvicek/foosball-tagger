import type { Game, Match } from '../data/types'
import { currentMatch, gameInMatch, gameLabel, interleaveProblem, matchNumber, matchResult, newMatch, resultLabel, sortMatches } from './matches'

let seq = 0
function m(id: string, extra: Partial<Match> = {}): Match {
  seq++
  return {
    id,
    user_id: 'u',
    video_id: 'v',
    best_of: null,
    format: 'singles',
    teammate: null,
    opponent: null,
    opponent2: null,
    notes: null,
    created_at: `2026-09-24T00:00:${String(seq).padStart(2, '0')}Z`,
    updated_at: '2026-09-24T00:00:00Z',
    ...extra,
  }
}
function g(id: string, match_id: string, start_s: number, end_s: number | null, extra: Partial<Game> = {}): Game {
  return {
    id,
    user_id: 'u',
    video_id: 'v',
    match_id,
    start_s,
    end_s,
    my_side: 'left',
    my_score: null,
    opp_score: null,
    notes: null,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
    ...extra,
  }
}

describe('ordering and labels', () => {
  const A = m('A')
  const B = m('B')
  const E = m('E') // empty
  const games = [g('b1', 'B', 10, 20), g('a1', 'A', 300, 400), g('b2', 'B', 20, 30)]

  it('orders matches by their first game, empty ones last', () => {
    expect(sortMatches([E, A, B], games).map((x) => x.id)).toEqual(['B', 'A', 'E'])
    expect(matchNumber([E, A, B], games, 'A')).toBe(2)
  })

  it('numbers games within their match', () => {
    expect(gameInMatch(games, games[2] as Game)).toBe(2)
    expect(gameLabel([A, B], games, games[1] as Game)).toBe('Match 2 · Game 1')
  })

  it('picks the selected match, else the last one', () => {
    expect(currentMatch([A, B], games, 'B')?.id).toBe('B')
    expect(currentMatch([A, B], games, 'gone')?.id).toBe('A')
    expect(currentMatch([], [], null)).toBeUndefined()
  })
})

describe('interleaveProblem', () => {
  it('accepts consecutive matches and refuses a game between another match’s games', () => {
    const A = m('A')
    const B = m('B')
    expect(interleaveProblem([A, B], [g('a1', 'A', 0, 10), g('b1', 'B', 10, 20)])).toBeNull()
    expect(interleaveProblem([A, B], [g('a1', 'A', 0, 10), g('b1', 'B', 10, 20), g('a2', 'A', 30, null)])).toBe(
      'Match 1 and Match 2 would interleave at 0:30.0. A match’s games follow each other: start a new match with M, or select the match being played.',
    )
  })
})

describe('matchResult', () => {
  it('counts only fully scored games; a tie counts for neither', () => {
    const M3 = m('M', { best_of: 3 })
    const games = [
      g('1', 'M', 0, 1, { my_score: 5, opp_score: 3 }),
      g('2', 'M', 1, 2, { my_score: 5, opp_score: 5 }),
      g('3', 'M', 2, 3, { my_score: 5, opp_score: null }),
      g('x', 'other', 3, 4, { my_score: 0, opp_score: 5 }),
    ]
    expect(matchResult(M3, games)).toEqual({ won: 1, lost: 0, games: 3, decided: false, over: false })
  })

  it('is decided once a side has more than half of best_of; over when games exceed it', () => {
    const won = (id: string, s: number) => g(id, 'M', s, s + 1, { my_score: 5, opp_score: 2 })
    const M2 = m('M', { best_of: 2 })
    expect(matchResult(M2, [won('1', 0)]).decided).toBe(false) // 1 of 2 is a half, not more
    expect(matchResult(M2, [won('1', 0), won('2', 1)]).decided).toBe(true)
    expect(matchResult(m('M', { best_of: 1 }), [won('1', 0), won('2', 1)]).over).toBe(true)
    expect(matchResult(m('M'), [won('1', 0), won('2', 1)])).toMatchObject({ decided: false, over: false })
  })

  it('labels the result', () => {
    const games = [g('1', 'M', 0, 1, { my_score: 5, opp_score: 3 }), g('2', 'M', 1, 2, { my_score: 5, opp_score: 4 })]
    expect(resultLabel(m('M', { best_of: 3 }), games)).toBe('2–0 · BO3 · decided')
    expect(resultLabel(m('M', { best_of: 5 }), [])).toBe('BO5')
    expect(resultLabel(m('M'), [])).toBe('')
  })
})

describe('newMatch', () => {
  it('copies format, players and best-of from the given match; notes stay behind', () => {
    const from = m('A', { format: 'doubles', teammate: 'Eva', opponent: 'Tom', opponent2: 'Ida', best_of: 5, notes: 'x' })
    expect(newMatch({ id: 'N', userId: 'u', videoId: 'v', now: 'T' }, from)).toEqual({
      id: 'N', user_id: 'u', video_id: 'v', best_of: 5, format: 'doubles', teammate: 'Eva', opponent: 'Tom', opponent2: 'Ida',
      notes: null, created_at: 'T', updated_at: 'T',
    })
    expect(newMatch({ id: 'N', userId: 'u', videoId: 'v', now: 'T' }, undefined)).toMatchObject({ format: 'singles', best_of: null, opponent: null })
  })
})
