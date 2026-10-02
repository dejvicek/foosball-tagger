import { summary } from './testData'
import { deleteSummary, formatDate, formatDuration, playersLabel, plural } from './format'

const base = summary()

describe('deleteSummary', () => {
  it('lists every kind of row that will go', () => {
    expect(
      deleteSummary({ ...base, game_count: 3, possession_count: 45, confirmed_possession_count: 40, calibration_count: 1, job_count: 2 }),
    ).toBe('This also removes 3 games, 45 possessions (5 not confirmed), 1 playfield calibration and 2 analysis jobs. It cannot be undone.')
  })

  it('handles singular and a single kind', () => {
    expect(deleteSummary({ ...base, game_count: 1 })).toBe('This also removes 1 game. It cannot be undone.')
  })

  it('says when nothing else is removed', () => {
    expect(deleteSummary(base)).toMatch(/no games or possessions yet/)
  })
})

describe('playersLabel (GAM-2)', () => {
  const m = { format: 'singles' as const, teammate: null, opponent: null, opponent2: null }
  it('names the opponent in singles, and teammate and both opponents in doubles', () => {
    expect(playersLabel(m)).toBe('')
    expect(playersLabel({ ...m, opponent: 'Olaf' })).toBe('vs Olaf')
    expect(playersLabel({ ...m, format: 'doubles', teammate: 'Eva', opponent: 'Olaf', opponent2: 'Tom' })).toBe('with Eva · vs Olaf & Tom')
    expect(playersLabel({ ...m, format: 'doubles', opponent2: 'Tom' })).toBe('vs Tom')
  })
})

describe('formatting', () => {
  it('pluralizes', () => {
    expect(plural(0, 'game')).toBe('0 games')
    expect(plural(1, 'game')).toBe('1 game')
  })

  it('formats durations', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3723.4)).toBe('1:02:03')
  })

  it('formats calendar dates without shifting the day', () => {
    expect(formatDate('2026-09-23')).toMatch(/23/)
  })
})
