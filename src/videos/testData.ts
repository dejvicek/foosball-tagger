import type { VideoSummary } from '../data/types'

export function summary(overrides: Partial<VideoSummary> = {}): VideoSummary {
  return {
    id: 'v1',
    user_id: 'u1',
    youtube_id: 'dQw4w9WgXcQ',
    title: 'Practice',
    duration_s: null,
    aspect_ratio: 16 / 9,
    fps: 30,
    recorded_on: null,
    notes: null,
    created_at: '2026-09-24T10:00:00Z',
    updated_at: '2026-09-24T10:00:00Z',
    game_count: 0,
    confirmed_possession_count: 0,
    possession_count: 0,
    calibration_count: 0,
    job_count: 0,
    job_running: false,
    ...overrides,
  }
}
