import { videoDate } from './stats'

describe('videoDate', () => {
  it('uses the recorded date, else the day the video was added', () => {
    expect(videoDate({ recorded_on: '2026-09-01', created_at: '2026-09-20T10:00:00Z' })).toBe('2026-09-01')
    expect(videoDate({ recorded_on: null, created_at: '2026-09-20T10:00:00Z' })).toBe('2026-09-20')
  })
})
