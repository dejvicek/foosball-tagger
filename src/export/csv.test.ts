import type { Game, Possession } from '../data/types'
import type { ScopeData } from '../data/stats'
import { summary } from '../videos/testData'
import { EXPORT_COLUMNS, csvField, exportCsv, exportRows } from './csv'

const game = (o: Partial<Game>): Game => ({
  id: 'g1',
  user_id: 'u1',
  video_id: 'v1',
  start_s: 0,
  end_s: null,
  my_side: 'left',
  format: 'singles',
  teammate: null,
  opponent: null,
  opponent2: null,
  my_score: null,
  opp_score: null,
  notes: null,
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
  ...o,
})

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

const data: ScopeData = {
  videos: [summary({ id: 'v1', youtube_id: 'abcdefghijk', title: 'Club night, "finals"', recorded_on: '2026-09-20' })],
  games: [
    game({ id: 'g2', start_s: 600, format: 'doubles', my_side: 'right', teammate: 'Eva', opponent: 'Tomáš', opponent2: 'Jan' }),
    game({ id: 'g1', start_s: 10, opponent: 'Tomáš' }),
  ],
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
      ['2', '1'],
    ])
    expect(rows[0]).toEqual({
      video_title: 'Club night, "finals"',
      recorded_on: '2026-09-20',
      youtube_id: 'abcdefghijk',
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
      'video_title,recorded_on,youtube_id,game_index,opponent,format,my_side,n,start_s,shot_s,length_s,setup,shot_type,movement,hole,shot_direction,result,execution,source',
    )
    expect(lines[1]).toBe('"Club night, ""finals""",2026-09-20,abcdefghijk,1,Tomáš,singles,left,1,12.00,16.50,4.50,Middle,Pull,Pull,Pull long,Straight,Goal,Misexecuted,manual')
    expect(lines).toHaveLength(5) // header, 3 rows, trailing ''
    expect(lines[4]).toBe('')
  })

  it('is just the header when nothing is in scope', () => {
    expect(exportCsv([])).toBe(EXPORT_COLUMNS.join(',') + '\r\n')
  })
})
