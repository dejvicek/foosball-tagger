import type { Game, Match, Possession } from '../data/types'
import type { ScopeData } from '../data/stats'
import { summary } from '../videos/testData'
import { EXPORT_COLUMNS, csvField, exportCsv, exportRows } from './csv'

const game = (o: Partial<Game>): Game => ({
  id: 'g1',
  user_id: 'u1',
  video_id: 'v1',
  match_id: 'm1',
  start_s: 0,
  end_s: null,
  my_side: 'left',
  my_score: null,
  opp_score: null,
  notes: null,
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
  ...o,
})

const gameRow = (id: string, matchId: string, startS: number): Game =>
  game({ id, match_id: matchId, video_id: 'v1', start_s: startS, created_at: '2026-09-20T10:00:00Z' })

const match = (o: Partial<Match>): Match => ({
  id: 'm1',
  user_id: 'u1',
  video_id: 'v1',
  best_of: null,
  format: 'singles',
  teammate: null,
  opponent: null,
  opponent2: null,
  notes: null,
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
  ...o,
})

const matchRow = (id: string, o?: Partial<Match>): Match => match({ id, video_id: 'v1', created_at: '2026-09-20T10:00:00Z', ...o })

const pos = (o: Partial<Possession>): Possession => ({
  id: 'p',
  user_id: 'u1',
  game_id: 'g1',
  start_s: null,
  shot_s: null,
  setup: null,
  shot_type: null,
  hole: null,
  shot_direction: null,
  result: null,
  execution: null,
  source: 'manual',
  confidence: null,
  review_status: 'confirmed',
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
  ...o,
})

const possRow = (id: string, gameId: string, startS: number): Possession =>
  pos({ id, game_id: gameId, start_s: startS, created_at: '2026-09-20T10:00:00Z' })

const data: ScopeData = {
  videos: [summary({ id: 'v1', youtube_id: 'abcdefghijk', title: 'Club night, "finals"', recorded_on: '2026-09-20' })],
  matches: [
    match({ id: 'm2', format: 'doubles', teammate: 'Eva', opponent: 'Tomáš', opponent2: 'Jan' }),
    match({ id: 'm1', opponent: 'Tomáš' }),
  ],
  games: [game({ id: 'g2', match_id: 'm2', start_s: 600, my_side: 'right' }), game({ id: 'g1', start_s: 10 })],
  possessions: [
    pos({ id: 'b', start_s: 30, shot_s: 34.456, setup: 'Pull side', shot_type: 'Pin', hole: 'Middle', shot_direction: 'Z', result: 'No goal', execution: 'Proper' }),
    pos({ id: 'a', start_s: 12, shot_s: 16.5, setup: 'Middle', shot_type: 'Pull', hole: 'Pull long', shot_direction: 'Straight', result: 'Goal', execution: 'Misexecuted' }),
    pos({ id: 'rej', start_s: 20, review_status: 'rejected', source: 'auto' }),
    pos({ id: 'cand', start_s: 40, shot_s: 41, review_status: 'unreviewed', source: 'auto' }),
    pos({ id: 'd', game_id: 'g2', shot_s: 700, shot_type: 'No shot' }),
  ],
}

describe('exportRows (EXP-1, EXP-3)', () => {
  it('exports confirmed possessions in game and time order, numbered as in the log', () => {
    const rows = exportRows(data, { includeUnreviewed: false })
    expect(rows.map((r) => [r.game_index, r.n])).toEqual([
      ['1', '1'],
      ['1', '2'],
      ['1', '1'],
    ])
    expect(rows[0]).toEqual({
      video_title: 'Club night, "finals"',
      recorded_on: '2026-09-20',
      youtube_id: 'abcdefghijk',
      match_index: '1',
      best_of: '',
      game_index: '1',
      opponent: 'Tomáš',
      format: 'singles',
      my_side: 'left',
      n: '1',
      start_s: '12.00',
      shot_s: '16.50',
      length_s: '4.50',
      setup: 'Middle',
      shot_type: 'Pull',
      movement: 'Pull',
      hole: 'Pull long',
      shot_direction: 'Straight',
      result: 'Goal',
      execution: 'Misexecuted',
      source: 'manual',
    })
    expect(rows[1]).toMatchObject({ shot_s: '34.46', length_s: '4.46', movement: 'Push', shot_direction: 'Z' })
  })

  it('leaves blanks empty and joins doubles opponents', () => {
    const d = exportRows(data, { includeUnreviewed: false })[2]
    expect(d).toMatchObject({ opponent: 'Tomáš & Jan', format: 'doubles', my_side: 'right', start_s: '', shot_s: '700.00', length_s: '', setup: '', movement: '', hole: '' })
  })

  it('adds unreviewed candidates only when asked; rejected never', () => {
    const rows = exportRows(data, { includeUnreviewed: true })
    expect(rows.map((r) => r.n)).toEqual(['1', '2', '3', '1'])
    expect(rows[2]).toMatchObject({ start_s: '40.00', source: 'auto' })
  })

  it('keeps only the possessions the filter passes', () => {
    expect(exportRows(data, { includeUnreviewed: false, keep: (id) => id === 'b' }).map((r) => r.n)).toEqual(['2'])
  })

  it('numbers matches within the video and games within the match (EXP-1, ADR-0040)', () => {
    const scopeData: ScopeData = {
      videos: [summary({ id: 'v1', youtube_id: 'abcdefghijk', title: 'Test video', recorded_on: '2026-09-20' })],
      matches: [matchRow('m1', { best_of: 3 }), matchRow('m2', { best_of: null, opponent: 'Ida' })],
      games: [gameRow('g1', 'm1', 0), gameRow('g2', 'm1', 100), gameRow('g3', 'm2', 200)],
      possessions: [possRow('p1', 'g1', 1), possRow('p2', 'g2', 101), possRow('p3', 'g3', 201)],
    }
    const rows = exportRows(scopeData, { includeUnreviewed: false })
    expect(rows.map((r) => [r.match_index, r.best_of, r.game_index, r.opponent])).toEqual([
      ['1', '3', '1', ''],
      ['1', '3', '2', ''],
      ['2', '', '1', 'Ida'],
    ])
    expect(exportCsv(rows).split('\r\n')[0]).toBe(
      'video_title,recorded_on,youtube_id,match_index,best_of,game_index,opponent,format,my_side,n,start_s,shot_s,length_s,setup,shot_type,movement,hole,shot_direction,result,execution,source',
    )
  })
})

describe('CSV text (EXP-1)', () => {
  it('quotes per RFC 4180', () => {
    expect(csvField('plain')).toBe('plain')
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('two\nlines')).toBe('"two\nlines"')
    expect(csvField('')).toBe('')
  })

  it('has the header row and CRLF line ends', () => {
    const csv = exportCsv(exportRows(data, { includeUnreviewed: false }))
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(','))
    expect(lines[0]).toBe(
      'video_title,recorded_on,youtube_id,match_index,best_of,game_index,opponent,format,my_side,n,start_s,shot_s,length_s,setup,shot_type,movement,hole,shot_direction,result,execution,source',
    )
    expect(lines[1]).toBe('"Club night, ""finals""",2026-09-20,abcdefghijk,1,,1,Tomáš,singles,left,1,12.00,16.50,4.50,Middle,Pull,Pull,Pull long,Straight,Goal,Misexecuted,manual')
    expect(lines).toHaveLength(5) // header, 3 rows, trailing ''
    expect(lines[4]).toBe('')
  })

  it('is just the header when nothing is in scope', () => {
    expect(exportCsv([])).toBe(EXPORT_COLUMNS.join(',') + '\r\n')
  })
})
