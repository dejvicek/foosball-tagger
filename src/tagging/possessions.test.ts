import type { Possession } from '../data/types'
import { emptyDraft } from './draft'
import { describe as describeP, fromDraft, isFoul, lookLabel, segmentClass, segmentLook, possessionAt, possessionLength, sortPossessions } from './possessions'

let seq = 0
function p(start_s: number | null, shot_s: number | null, extra: Partial<Possession> = {}): Possession {
  seq++
  return {
    ...fromDraft({ ...emptyDraft(), start_s, shot_s }, { id: `p${seq}`, userId: 'u', gameId: 'g', now: `2026-09-24T00:00:${String(seq).padStart(2, '0')}Z` }),
    ...extra,
  }
}

describe('possession helpers', () => {
  it('sorts by start, else shot; blanks last', () => {
    const a = p(50, 55)
    const b = p(null, 20)
    const c = p(null, null)
    const d = p(10, 12)
    expect(sortPossessions([a, b, c, d]).map((x) => x.id)).toEqual([d.id, b.id, a.id, c.id])
  })

  it('derives length only with both times', () => {
    expect(possessionLength(p(10, 14.5))).toBe(4.5)
    expect(possessionLength(p(10, null))).toBeNull()
  })

  it('flags possessions over 15 s as fouls, keeping 15 s itself legal (ADR-0029)', () => {
    expect(isFoul(possessionLength(p(10, 25)))).toBe(false)
    expect(isFoul(possessionLength(p(10, 25.1)))).toBe(true)
    expect(isFoul(possessionLength(p(10, null)))).toBe(false)
    expect(describeP(p(10, 30, { result: 'Goal' }), 1)).toContain('foul, 20.0 s')
  })

  it('draws result as color, execution as pattern, No shot hollow, fouls ringed (TAG-6, ADR-0037)', () => {
    const cls = (x: Possession) => segmentClass(segmentLook(x))
    expect(cls(p(1, 2, { result: 'Goal', execution: 'Proper' }))).toBe('goal proper')
    expect(cls(p(1, 2, { result: 'No goal', execution: 'Misexecuted' }))).toBe('nogoal mis')
    expect(cls(p(1, 2))).toBe('noresult blank')
    expect(cls(p(1, 2, { shot_type: 'No shot', result: null }))).toBe('noshot')
    expect(cls(p(1, 20, { shot_type: 'No shot' }))).toBe('noshot foul')
    expect(cls(p(1, 2, { result: 'Goal', execution: 'Proper', review_status: 'unreviewed' }))).toBe('goal proper candidate')
    expect(lookLabel(segmentLook(p(1, 20, { result: 'Goal', execution: 'Misexecuted' })))).toBe('Goal, misexecuted, foul')
  })

  it('finds the possession under the playhead (TAG-7)', () => {
    const list = [p(10, 15), p(20, 30)]
    expect(possessionAt(list, 25)?.start_s).toBe(20)
    expect(possessionAt(list, 17)).toBeNull()
  })

  it('describes tags for hover', () => {
    expect(describeP(p(1, 2, { shot_type: 'Pull', result: 'Goal', shot_direction: 'Z' }), 3)).toBe('#3 Middle · Pull · Z · Goal')
  })

  it('makes manual confirmed rows from drafts', () => {
    expect(p(1, 2)).toMatchObject({ source: 'manual', review_status: 'confirmed', confidence: null, game_id: 'g' })
  })
})
