// Statistics against fixtures/synthetic-01.json. Every expected number below was
// worked out by hand from the fixture's possession list, not from the code.
import synthetic from '../../fixtures/synthetic-01.json'
import { fixtureItems, type Fixture } from './fixture'
import { byHole, byLength, byShotDirection, movementOf, bySetup, byShot, confirmedOnly, executionVsResult, headline, shotStatus, applyFilters, NO_FILTERS, formatRatio, ratio, opponentsOf, gameOpponents, type StatItem } from '.'

const all = fixtureItems(synthetic as Fixture)
const items = confirmedOnly(all)
const r = (num: number, den: number) => expect.objectContaining({ num, den })

describe('fixture sanity', () => {
  it('uses confirmed possessions only (PRD §5)', () => {
    expect(all).toHaveLength(15)
    expect(items).toHaveLength(13)
  })
})

describe('headline (STA-5)', () => {
  const h = headline(items)

  it('counts possessions and shots; untagged-type possessions with a shot time are shots', () => {
    expect(h.possessions).toBe(13)
    expect(h.shots).toBe(10) // #1–7, #11, #12, #13
  })

  it('conversion leaves out shots without a result (STA-1)', () => {
    expect(h.conversion).toEqual(r(5, 9)) // goals #1 #3 #5 #6 #11; #12 has no result
  })

  it('proper rate leaves out shots without an execution', () => {
    expect(h.proper).toEqual(r(6, 8)) // proper #1 #2 #5 #7 #11 #12; #6 #13 blank
  })

  it('median length over possessions with both times', () => {
    expect(h.medianLength).toBe(7) // 3 3 4 4 6 [7] 9 11 12 15 17
    expect(h.medianOf).toBe(11)
  })

  it('no-shot share over possessions whose outcome is known', () => {
    expect(h.noShotShare).toEqual(r(2, 12)) // #8 #9 of 12; #10 (no shot time, no type) unknown
    expect(shotStatus(items.find((p) => p.id === 'p10') as StatItem)).toBe('unknown')
  })
})

describe('by shot (STA-6)', () => {
  const rows = byShot(items)
  const key = (x: (typeof rows)[number]) => [x.shotType, x.movement, x.hole].map((v) => v ?? '–').join(' · ')

  it('groups by type + derived movement + hole, most attempts first (ADR-0026)', () => {
    expect(rows.map((x) => [key(x), x.attempts])).toEqual([
      ['Pin · Pull · Pull long', 2], // #1 #6
      ['Pin · Pull · Pull short', 1], // #2
      ['Pin · Push · Push short', 1], // #11
      ['Pin · Straight · Pull long', 1], // #3: pull-side setup
      ['Pull · Pull · Pull short', 1], // #5: push-side setup
      ['Pull · Straight · Middle', 1], // #4
      ['Pull · – · Middle', 1], // #12: no setup, so no movement
      ['Other · – · –', 1],
      ['– · – · –', 1],
    ])
  })

  it('reports goals, conversion, proper rate and average length per row', () => {
    const [pinPull, pinPullShort, , pinStraight] = rows
    expect(pinPull).toMatchObject({ goals: 2, conversion: r(2, 2), proper: r(1, 1), avgLength: 4, avgOf: 2 }) // #6 no execution
    expect(pinPullShort).toMatchObject({ goals: 0, conversion: r(0, 1), proper: r(1, 1), avgLength: 6, avgOf: 1 })
    expect(pinStraight).toMatchObject({ goals: 1, conversion: r(1, 1), proper: r(0, 1), avgLength: 3 })
    expect(rows[2]).toMatchObject({ avgLength: null, avgOf: 0 }) // #11: no start
    expect(rows[6]).toMatchObject({ conversion: r(0, 0), proper: r(1, 1), avgLength: 9 }) // #12: no result
    expect(rows[8]).toMatchObject({ conversion: r(0, 1), proper: r(0, 0), avgLength: 11 }) // #13
  })
})

describe('movement (ADR-0026, ADR-0028)', () => {
  it('is Straight when the hole is on the setup’s side; a setup covers its whole lane', () => {
    expect(movementOf('Pull side', 'Pull long')).toBe('Straight')
    expect(movementOf('Pull side', 'Pull short')).toBe('Straight')
    expect(movementOf('Pull side', 'Middle')).toBe('Push')
    expect(movementOf('Pull side', 'Push long')).toBe('Push')
    expect(movementOf('Middle', 'Pull long')).toBe('Pull')
    expect(movementOf('Middle', 'Middle')).toBe('Straight')
    expect(movementOf('Middle', 'Push short')).toBe('Push')
    expect(movementOf('Push side', 'Push long')).toBe('Straight')
    expect(movementOf('Push side', 'Middle')).toBe('Pull')
    expect(movementOf('Push side', 'Pull short')).toBe('Pull')
  })

  it('is blank when the setup or the hole is blank', () => {
    expect(movementOf(null, 'Middle')).toBeNull()
    expect(movementOf('Middle', null)).toBeNull()
  })
})

describe('execution vs result (STA-7)', () => {
  it('2×2 over shots with both tagged, conversion per row', () => {
    expect(executionVsResult(items)).toEqual([
      { execution: 'Proper', goals: 3, noGoals: 2, conversion: r(3, 5) },
      { execution: 'Misexecuted', goals: 1, noGoals: 1, conversion: r(1, 2) },
    ])
  })
})

describe('by possession length (STA-8)', () => {
  it('buckets shots with both times; a bucket includes its lower bound', () => {
    expect(byLength(items).map((b) => [b.label, b.attempts, b.conversion.num, b.conversion.den, b.proper.num, b.proper.den])).toEqual([
      ['Under 5 s', 3, 3, 3, 1, 2],
      ['5–10 s', 3, 0, 2, 3, 3],
      ['10–15 s', 2, 0, 2, 0, 1],
      ['15 s or more', 1, 1, 1, 1, 1],
    ])
  })
})

describe('by setup (STA-9)', () => {
  it('Middle vs off-middle over shots with a setup', () => {
    expect(bySetup(items).map((b) => [b.label, b.attempts, b.conversion.num, b.conversion.den, b.proper.num, b.proper.den])).toEqual([
      ['Middle', 6, 3, 6, 4, 5],
      ['Off-middle', 3, 2, 3, 1, 2],
      ['Pull side', 2, 1, 2, 0, 1],
      ['Push side', 1, 1, 1, 1, 1],
    ])
  })
})

describe('by hole (STA-10)', () => {
  it('conversion per hole over shots with a hole', () => {
    expect(byHole(items).map((b) => [b.label, b.attempts, b.conversion.num, b.conversion.den])).toEqual([
      ['Pull long', 3, 3, 3],
      ['Pull short', 2, 1, 2],
      ['Middle', 2, 0, 1], // #12 has no result
      ['Push short', 1, 1, 1],
      ['Push long', 0, 0, 0],
    ])
  })
})

describe('by shot direction (ADR-0028)', () => {
  it('conversion and proper rate over shots with a shot direction', () => {
    expect(byShotDirection(items).map((b) => [b.label, b.attempts, b.conversion.num, b.conversion.den, b.proper.num, b.proper.den])).toEqual([
      ['Straight', 6, 4, 6, 5, 5], // #1 #2 #5 #6 #7 #11; #6 has no execution
      ['Z', 3, 1, 2, 1, 3], // #3 #4 #12; #12 has no result
    ])
  })
})

describe('percentages (STA-2, STA-3)', () => {
  it('carry their sample and mark small ones', () => {
    expect(formatRatio(ratio(7, 12))).toBe('58% (7/12)')
    expect(formatRatio(ratio(0, 0))).toBe('– (0/0)')
    expect(ratio(7, 12).small).toBe(true)
    expect(ratio(20, 30).small).toBe(false)
  })

  it('every percentage in the fixture rests on a small sample', () => {
    expect(headline(items).conversion.small).toBe(true)
  })
})

describe('filters (STA-4)', () => {
  const other: StatItem[] = items.slice(0, 3).map((p, i) => ({ ...p, id: `o${i}`, gameId: 'g2', format: 'doubles', opponents: [] }))
  const mixed = [...items, ...other]

  it('by shot type', () => {
    const pins = applyFilters(items, { ...NO_FILTERS, shotTypes: ['Pin'] })
    expect(pins.map((p) => p.id)).toEqual(['p01', 'p02', 'p03', 'p06', 'p11'])
    expect(headline(pins).conversion).toEqual(r(4, 5))
  })

  it('by format and opponent (blank opponent selectable)', () => {
    expect(applyFilters(mixed, { ...NO_FILTERS, format: 'doubles' })).toHaveLength(3)
    expect(applyFilters(mixed, { ...NO_FILTERS, opponent: 'Tomáš' })).toHaveLength(13)
    expect(applyFilters(mixed, { ...NO_FILTERS, opponent: '' })).toHaveLength(3)
    expect(opponentsOf(mixed)).toEqual(['', 'Tomáš'])
  })

  it('matches either opponent of a doubles game', () => {
    const pair: StatItem[] = items.slice(0, 2).map((p, i) => ({ ...p, id: `d${i}`, gameId: 'g3', format: 'doubles', opponents: ['Eva', 'Olaf'] }))
    const withPair = [...mixed, ...pair]
    expect(applyFilters(withPair, { ...NO_FILTERS, opponent: 'Olaf' }).map((p) => p.id)).toEqual(['d0', 'd1'])
    expect(applyFilters(withPair, { ...NO_FILTERS, opponent: 'Eva' })).toHaveLength(2)
    expect(opponentsOf(withPair)).toEqual(['', 'Eva', 'Olaf', 'Tomáš'])
    expect(gameOpponents({ opponent: 'Eva', opponent2: null })).toEqual(['Eva'])
    expect(gameOpponents({ opponent: null, opponent2: 'Olaf' })).toEqual(['Olaf'])
  })

  it('no filters keeps everything', () => {
    expect(applyFilters(mixed, NO_FILTERS)).toHaveLength(16)
  })
})

describe('empty input', () => {
  it('gives zeros and blank percentages, never NaN', () => {
    const h = headline([])
    expect(h).toMatchObject({ possessions: 0, shots: 0, medianLength: null, conversion: r(0, 0) })
    expect(h.conversion.pct).toBeNull()
    expect(byShot([])).toEqual([])
  })
})
