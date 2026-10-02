// CSV export (EXP-1, EXP-3). Pure: builds rows and text from loaded scope data.
import type { ScopeData } from '../data/stats'
import { videoDate } from '../data/stats'
import { movementOf } from '../stats/movement'
import { numberPossessions, possessionLength } from '../tagging/possessions'
import { sortMatches, matchGames, matchOpponents } from '../videos/matches'

/** EXP-1 columns (ADR-0028, ADR-0040); `direction` is `movement` plus `shot_direction` since ADR-0028. */
export const EXPORT_COLUMNS = [
  'video_title',
  'recorded_on',
  'youtube_id',
  'match_index',
  'best_of',
  'game_index',
  'opponent',
  'format',
  'my_side',
  'n',
  'start_s',
  'shot_s',
  'length_s',
  'setup',
  'shot_type',
  'movement',
  'hole',
  'shot_direction',
  'result',
  'execution',
  'source',
] as const

export type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], string>

export interface ExportOptions {
  /** EXP-3: add unreviewed candidates to the confirmed possessions. Rejected ones are never exported. */
  includeUnreviewed: boolean
  /** Possessions to keep, e.g. those passing the statistics filters (ADR-0035). */
  keep?: (possessionId: string) => boolean
}

const time = (s: number | null) => (s == null ? '' : s.toFixed(2))
const text = (v: string | null | undefined) => v ?? ''

/** Rows ordered by video (date, title), match, game within the match, and possession number. */
export function exportRows(data: ScopeData, opts: ExportOptions): ExportRow[] {
  const videos = [...data.videos].sort(
    (a, b) => videoDate(a).localeCompare(videoDate(b)) || text(a.title).localeCompare(text(b.title)) || a.created_at.localeCompare(b.created_at),
  )
  const rows: ExportRow[] = []
  for (const v of videos) {
    const vGames = data.games.filter((g) => g.video_id === v.id)
    sortMatches(data.matches.filter((m) => m.video_id === v.id), vGames).forEach((match, mi) => {
      matchGames(vGames, match.id).forEach((g, gi) => {
        const numbered = numberPossessions(data.possessions.filter((p) => p.game_id === g.id))
        for (const { p, n } of numbered) {
          if (n == null) continue
          if (p.review_status === 'unreviewed' && !opts.includeUnreviewed) continue
          if (opts.keep && !opts.keep(p.id)) continue
          rows.push({
            video_title: text(v.title),
            recorded_on: text(v.recorded_on),
            youtube_id: v.youtube_id,
            match_index: String(mi + 1),
            best_of: match.best_of == null ? '' : String(match.best_of),
            game_index: String(gi + 1),
            opponent: matchOpponents(match).join(' & '),
            format: match.format,
            my_side: g.my_side,
            n: String(n),
            start_s: time(p.start_s),
            shot_s: time(p.shot_s),
            length_s: time(possessionLength(p)),
            setup: text(p.setup),
            shot_type: text(p.shot_type),
            movement: text(movementOf(p.setup, p.hole)),
            hole: text(p.hole),
            shot_direction: text(p.shot_direction),
            result: text(p.result),
            execution: text(p.execution),
            source: p.source,
          })
        }
      })
    })
  }
  return rows
}

/** RFC 4180: quote fields holding a comma, quote or line break; double inner quotes. */
export function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function exportCsv(rows: readonly ExportRow[]): string {
  const line = (fields: readonly string[]) => fields.map(csvField).join(',') + '\r\n'
  return line(EXPORT_COLUMNS) + rows.map((r) => line(EXPORT_COLUMNS.map((c) => r[c]))).join('')
}
