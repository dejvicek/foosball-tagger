import { emptyDraft } from './draft'
import { loadDraft } from './draftStore'

describe('loadDraft', () => {
  beforeEach(() => localStorage.clear())

  it('drops a direction and an old hole kept from before ADR-0026', () => {
    localStorage.setItem('fbtag:draft:v1:g1', JSON.stringify({ ...emptyDraft(), start_s: 70, direction: 'Pull', hole: 'Pull-side lane' }))
    expect(loadDraft('g1')).toEqual({ ...emptyDraft(), start_s: 70 })
  })

  it('keeps a current hole', () => {
    localStorage.setItem('fbtag:draft:v1:g1', JSON.stringify({ ...emptyDraft(), hole: 'Push short' }))
    expect(loadDraft('g1').hole).toBe('Push short')
  })

  it('reads a kept Z/7 as Z (ADR-0030)', () => {
    localStorage.setItem('fbtag:draft:v1:g1', JSON.stringify({ ...emptyDraft(), shot_direction: 'Z/7' }))
    expect(loadDraft('g1').shot_direction).toBe('Z')
  })
})
