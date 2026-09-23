import { formatTime } from './time'

describe('formatTime', () => {
  it.each([
    [0, '0:00.0'],
    [5.26, '0:05.3'],
    [65.04, '1:05.0'],
    [59.96, '1:00.0'],
    [3723.45, '1:02:03.5'],
    [null, '–'],
  ])('%s → %s', (t, s) => {
    expect(formatTime(t)).toBe(s)
  })

  it('supports whole seconds', () => {
    expect(formatTime(65.4, 0)).toBe('1:05')
  })
})
