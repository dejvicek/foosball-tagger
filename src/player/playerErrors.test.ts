import { describePlayerError } from './playerErrors'

describe('describePlayerError', () => {
  it('explains private or removed videos', () => {
    expect(describePlayerError(100).fix).toMatch(/Public or Unlisted/)
  })

  it.each([101, 150])('explains embedding disabled (%i)', (code) => {
    expect(describePlayerError(code).fix).toMatch(/Allow embedding/)
  })

  it('falls back for unknown codes', () => {
    expect(describePlayerError(999).reason).toMatch(/error 999/)
  })
})
