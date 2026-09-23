const ID = /^[A-Za-z0-9_-]{11}$/
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])
const PATH_PREFIXES = ['live', 'shorts', 'embed', 'v']

export type ParseResult = { ok: true; youtubeId: string } | { ok: false; message: string }

const NOT_YOUTUBE =
  'That is not a YouTube video link. Paste a link like https://www.youtube.com/watch?v=… or https://youtu.be/…'

/**
 * Extracts the video id from any common YouTube URL form (PRD §4.4):
 * watch?v=, youtu.be/, live/, shorts/, embed/, with or without t= or other parameters.
 */
export function parseYouTubeUrl(input: string): ParseResult {
  const text = input.trim()
  if (!text) return { ok: false, message: 'Paste a YouTube link.' }

  let url: URL
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return { ok: false, message: NOT_YOUTUBE }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, message: NOT_YOUTUBE }

  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)
  let candidate: string | undefined

  if (host === 'youtu.be') {
    candidate = segments[0]
  } else if (HOSTS.has(host)) {
    if (segments[0] === 'watch') candidate = url.searchParams.get('v') ?? undefined
    else if (segments[0] && PATH_PREFIXES.includes(segments[0])) candidate = segments[1]
  } else {
    return { ok: false, message: NOT_YOUTUBE }
  }

  if (!candidate) {
    return { ok: false, message: 'This YouTube link does not point to a single video (channel, playlist or search pages do not work).' }
  }
  if (!ID.test(candidate)) return { ok: false, message: 'The video id in this link looks incomplete. Copy the link again from YouTube.' }
  return { ok: true, youtubeId: candidate }
}

export function watchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`
}
