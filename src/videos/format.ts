import type { VideoSummary } from '../data/types'

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** 2026-09-23 → "23 Sep 2026" (dates are calendar dates, not instants). */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Seconds → "1:02:03" or "4:05". */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function videoTitle(v: Pick<VideoSummary, 'title' | 'youtube_id'>): string {
  return v.title?.trim() || `Untitled video (${v.youtube_id})`
}

/** What deleting a video removes (PRD §5, VID-3). */
export function deleteSummary(v: VideoSummary): string {
  const unreviewed = v.possession_count - v.confirmed_possession_count
  const parts = [
    v.game_count > 0 ? plural(v.game_count, 'game') : null,
    v.possession_count > 0
      ? plural(v.possession_count, 'possession') + (unreviewed > 0 ? ` (${unreviewed} not confirmed)` : '')
      : null,
    v.calibration_count > 0 ? plural(v.calibration_count, 'playfield calibration') : null,
    v.job_count > 0 ? plural(v.job_count, 'analysis job') : null,
  ].filter((p): p is string => p !== null)
  if (parts.length === 0) return 'This video has no games or possessions yet. Nothing else is removed.'
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
  return `This also removes ${list}. It cannot be undone.`
}
