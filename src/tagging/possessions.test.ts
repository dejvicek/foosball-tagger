import type { Possession } from '../data/types'
import { emptyDraft } from './draft'
import { describe as describeP, fromDraft, outcomeOf, possessionAt, possessionLength, sortPossessions } from './possessions'

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

  it('classifies outcomes for the timeline (TAG-6)', () => {
    expect(outcomeOf(p(1, 2, { result: 'Goal' }))).toBe('goal')
    expect(outcomeOf(p(1, 2, { result: 'No goal' }))).toBe('nogoal')
    expect(outcomeOf(p(1, 2, { shot_type: 'No shot' }))).toBe('noshot')
    expect(outcomeOf(p(1, 2))).toBe('untagged')
    expect(outcomeOf(p(1, 2, { result: 'Goal', review_status: 'unreviewed' }))).toBe('candidate')
  })

  it('finds the possession under the playhead (TAG-7)', () => {
    const list = [p(10, 15), p(20, 30)]
    expect(possessionAt(list, 25)?.start_s).toBe(20)
    expect(possessionAt(list, 17)).toBeNull()
  })

  it('describes tags for hover', () => {
    expect(describeP(p(1, 2, { shot_type: 'Pull', result: 'Goal' }), 3)).toBe('#3 Middle · Pull · Goal')
  })

  it('makes manual confirmed rows from drafts', () => {
    expect(p(1, 2)).toMatchObject({ source: 'manual', review_status: 'confirmed', confidence: null, game_id: 'g' })
  })
})
