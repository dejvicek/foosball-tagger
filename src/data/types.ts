// Category values mirror the SQL CHECK constraints in supabase/migrations/.
// Change both together, via a new migration.

export const SETUPS = ['Middle', 'Pull side', 'Push side'] as const
export type Setup = (typeof SETUPS)[number]

export const SHOT_TYPES = ['Pin', 'Pull', 'Other', 'No shot'] as const
export type ShotType = (typeof SHOT_TYPES)[number]

export const DIRECTIONS = ['Pull', 'Push', 'Straight'] as const
export type Direction = (typeof DIRECTIONS)[number]

export const HOLES = ['Pull-side lane', 'Middle lane', 'Push-side lane'] as const
export type Hole = (typeof HOLES)[number]

export const RESULTS = ['Goal', 'No goal'] as const
export type Result = (typeof RESULTS)[number]

export const EXECUTIONS = ['Proper', 'Misexecuted'] as const
export type Execution = (typeof EXECUTIONS)[number]

export const SIDES = ['left', 'right'] as const
export type Side = (typeof SIDES)[number]

export const FORMATS = ['singles', 'doubles'] as const
export type Format = (typeof FORMATS)[number]

export const SOURCES = ['manual', 'auto'] as const
export type Source = (typeof SOURCES)[number]

export const REVIEW_STATUSES = ['unreviewed', 'confirmed', 'rejected'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const JOB_STATUSES = ['queued', 'downloading', 'analyzing', 'done', 'failed'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const FPS_VALUES = [30, 60] as const
export type Fps = (typeof FPS_VALUES)[number]

/** Point in normalized video-frame coordinates (0..1). */
export type FramePoint = {
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Rows (type aliases, not interfaces: supabase-js needs an implicit index
// signature). Dates are ISO strings as PostgREST returns them; video times are seconds.
// ---------------------------------------------------------------------------

export type Video = {
  id: string
  user_id: string
  youtube_id: string
  title: string | null
  duration_s: number | null
  aspect_ratio: number | null
  fps: Fps
  recorded_on: string | null // YYYY-MM-DD
  notes: string | null
  created_at: string
  updated_at: string
}

export type VideoSummary = Video & {
  game_count: number
  confirmed_possession_count: number
  possession_count: number
  calibration_count: number
  job_count: number
  job_running: boolean
}

export type Game = {
  id: string
  user_id: string
  video_id: string
  start_s: number
  end_s: number | null
  my_side: Side
  format: Format
  opponent: string | null
  my_score: number | null
  opp_score: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Calibration = {
  id: string
  user_id: string
  video_id: string
  game_id: string | null
  points: FramePoint[]
  frame_s: number | null
  created_at: string
}

export type Possession = {
  id: string
  user_id: string
  game_id: string
  start_s: number | null
  shot_s: number | null
  setup: Setup | null
  shot_type: ShotType | null
  direction: Direction | null
  hole: Hole | null
  result: Result | null
  execution: Execution | null
  source: Source
  confidence: number | null
  review_status: ReviewStatus
  created_at: string
  updated_at: string
}

export type AnalysisJob = {
  id: string
  user_id: string
  video_id: string
  game_id: string | null
  status: JobStatus
  progress: number | null
  message: string | null
  candidates: number | null
  requested_at: string
  started_at: string | null
  finished_at: string | null
}

// ---------------------------------------------------------------------------
// supabase-js schema type. Insert/Update omit server-filled columns.
// ---------------------------------------------------------------------------

type ServerFilled = 'user_id' | 'created_at' | 'updated_at'
type Insertable<T, Required extends keyof T> = Pick<T, Required> & Partial<Omit<T, ServerFilled | Required>>
type Updatable<T> = Partial<Omit<T, 'id' | ServerFilled>>

interface Table<Row, Insert, Update> {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type VideoInsert = Insertable<Video, 'youtube_id'>
export type VideoUpdate = Updatable<Video>

export interface Database {
  public: {
    Tables: {
      videos: Table<Video, VideoInsert, VideoUpdate>
      games: Table<Game, Insertable<Game, 'video_id' | 'start_s' | 'my_side'>, Updatable<Game>>
      calibrations: Table<Calibration, Insertable<Calibration, 'video_id' | 'points'>, Updatable<Calibration>>
      possessions: Table<Possession, Insertable<Possession, 'game_id'>, Updatable<Possession>>
      analysis_jobs: Table<AnalysisJob, Insertable<AnalysisJob, 'video_id'>, Updatable<AnalysisJob>>
    }
    Views: {
      video_summaries: { Row: VideoSummary; Relationships: [] }
    }
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
