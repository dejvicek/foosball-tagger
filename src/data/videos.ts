import { getSupabase } from './supabase'
import { DataError, toDataError } from './errors'
import { fetchVideoInfo } from './oembed'
import type { Video, VideoSummary, VideoUpdate } from './types'

// Video rows are written online only (ADR-0014); tagging writes go through queue.ts.

/** Newest first: by recorded date, then by when the video was added (VID-2). */
export function sortNewestFirst(videos: VideoSummary[]): VideoSummary[] {
  const key = (v: VideoSummary) => v.recorded_on ?? v.created_at.slice(0, 10)
  return [...videos].sort((a, b) => key(b).localeCompare(key(a)) || b.created_at.localeCompare(a.created_at))
}

export async function listVideos(): Promise<VideoSummary[]> {
  const { data, error } = await getSupabase().from('video_summaries').select('*')
  if (error) throw toDataError(error, 'load your videos')
  return sortNewestFirst(data)
}

export async function getVideo(id: string): Promise<VideoSummary | null> {
  const { data, error } = await getSupabase().from('video_summaries').select('*').eq('id', id).maybeSingle()
  if (error) throw toDataError(error, 'load the video')
  return data
}

async function findByYoutubeId(youtubeId: string): Promise<Video | null> {
  const { data, error } = await getSupabase().from('videos').select('*').eq('youtube_id', youtubeId).maybeSingle()
  if (error) throw toDataError(error, 'look up the video')
  return data
}

export interface AddResult {
  video: Video
  existed: boolean
}

/**
 * VID-1: opens the existing row for this YouTube id, or fetches title and aspect
 * ratio from oEmbed and creates one.
 */
export async function addVideo(youtubeId: string, fetchInfo = fetchVideoInfo): Promise<AddResult> {
  const existing = await findByYoutubeId(youtubeId)
  if (existing) return { video: existing, existed: true }

  const info = await fetchInfo(youtubeId).catch((err: unknown) => {
    throw new DataError(err instanceof Error ? err.message : String(err))
  })
  const { data, error } = await getSupabase()
    .from('videos')
    .insert({ youtube_id: youtubeId, title: info.title, aspect_ratio: info.aspectRatio })
    .select('*')
    .single()
  if (error) {
    // Added meanwhile in another tab: open that one.
    if (error.code === '23505') {
      const raced = await findByYoutubeId(youtubeId)
      if (raced) return { video: raced, existed: true }
    }
    throw toDataError(error, 'add the video')
  }
  return { video: data, existed: false }
}

export async function updateVideo(id: string, patch: VideoUpdate): Promise<Video> {
  const { data, error } = await getSupabase().from('videos').update(patch).eq('id', id).select('*').single()
  if (error) throw toDataError(error, 'save the video')
  return data
}

export async function deleteVideo(id: string): Promise<void> {
  const { error, count } = await getSupabase().from('videos').delete({ count: 'exact' }).eq('id', id)
  if (error) throw toDataError(error, 'delete the video')
  if (count === 0) throw new DataError('Could not delete the video: it no longer exists.')
}
