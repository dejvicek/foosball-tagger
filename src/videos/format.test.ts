import { summary } from './testData'
import { deleteSummary, formatDate, formatDuration, plural } from './format'

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
