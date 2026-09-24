import { percentAt, timeAtX } from './scrub'

describe('timeAtX', () => {
  const rect = { left: 100, width: 1000 }
  const threeHours = 3 * 3600

  it('maps the pointer to video time', () => {
    expect(timeAtX(100, rect, threeHours)).toBe(0)
    expect(timeAtX(600, rect, threeHours)).toBe(5400)
    expect(timeAtX(1100, rect, threeHours)).toBe(threeHours)
  })

  it('clamps outside the bar (dragging past the ends)', () => {
    expect(timeAtX(0, rect, threeHours)).toBe(0)
    expect(timeAtX(5000, rect, threeHours)).toBe(threeHours)
  })

  it('returns 0 before the size or duration is known', () => {
    expect(timeAtX(500, { left: 0, width: 0 }, threeHours)).toBe(0)
    expect(timeAtX(500, rect, 0)).toBe(0)
  })
})

describe('percentAt', () => {
  it('positions times on the bar', () => {
    expect(percentAt(2700, 10800)).toBe(25)
    expect(percentAt(-1, 100)).toBe(0)
    expect(percentAt(200, 100)).toBe(100)
    expect(percentAt(5, 0)).toBe(0)
  })
})
