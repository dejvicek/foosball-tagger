import { watchUrl } from '../player/youtubeUrl'

export interface VideoInfo {
  title: string | null
  /** Width / height of the video frame. */
  aspectRatio: number
}

export class OEmbedError extends Error {
  override name = 'OEmbedError'
}

/** Aspect ratios oEmbed's rounded player sizes are snapped to (e.g. 200×113 → 16:9). */
const COMMON_RATIOS = [16 / 9, 4 / 3, 9 / 16, 1, 21 / 9, 3 / 4]
const DEFAULT_RATIO = 16 / 9

export function aspectRatioFrom(width: unknown, height: unknown): number {
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) return DEFAULT_RATIO
  const raw = width / height
  const near = COMMON_RATIOS.find((r) => Math.abs(raw - r) / r < 0.02)
  return near ?? raw
}

/** Explains an oEmbed HTTP status in terms of what to change on YouTube (VID-1, VID-4). */
export function oEmbedStatusMessage(status: number): string {
  if (status === 401 || status === 403) {
    return (
      'YouTube does not allow this video to be embedded: it is private, or embedding is turned off. ' +
      'In YouTube Studio set visibility to Public or Unlisted, and under Details → Show more tick “Allow embedding”.'
    )
  }
  if (status === 400 || status === 404) return 'YouTube has no video at this link. It may have been removed, or the link is mistyped.'
  return `YouTube did not answer as expected (HTTP ${status}). Try again in a moment.`
}

/** Title and aspect ratio from YouTube oEmbed (CORS-enabled, no API key). */
export async function fetchVideoInfo(youtubeId: string, fetchImpl: typeof fetch = fetch): Promise<VideoInfo> {
  const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(youtubeId))}`
  let response: Response
  try {
    response = await fetchImpl(endpoint)
  } catch {
    throw new OEmbedError('Could not reach YouTube. Check your connection and try again.')
  }
  if (!response.ok) throw new OEmbedError(oEmbedStatusMessage(response.status))
  const body: unknown = await response.json().catch(() => null)
  const data = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  return {
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : null,
    aspectRatio: aspectRatioFrom(data.width, data.height),
  }
}
