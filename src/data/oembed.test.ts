import { aspectRatioFrom, fetchVideoInfo, OEmbedError } from './oembed'

function respond(status: number, body: unknown = {}): typeof fetch {
  return vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }))
}

describe('aspectRatioFrom', () => {
  it('snaps rounded player sizes to common ratios', () => {
    expect(aspectRatioFrom(200, 113)).toBe(16 / 9)
    expect(aspectRatioFrom(356, 200)).toBe(16 / 9)
    expect(aspectRatioFrom(113, 200)).toBe(9 / 16)
    expect(aspectRatioFrom(200, 150)).toBe(4 / 3)
  })

  it('keeps an unusual ratio, and defaults to 16:9 without sizes', () => {
    expect(aspectRatioFrom(300, 100)).toBe(3)
    expect(aspectRatioFrom(undefined, 113)).toBe(16 / 9)
    expect(aspectRatioFrom(0, 0)).toBe(16 / 9)
  })
})

describe('fetchVideoInfo', () => {
  it('returns title and aspect ratio', async () => {
    const f = respond(200, { title: ' Practice 23.9. ', width: 200, height: 113 })
    await expect(fetchVideoInfo('dQw4w9WgXcQ', f)).resolves.toEqual({ title: 'Practice 23.9.', aspectRatio: 16 / 9 })
    expect(vi.mocked(f).mock.calls[0]?.[0]).toBe(
      'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ',
    )
  })

  it('explains private or non-embeddable videos', async () => {
    await expect(fetchVideoInfo('dQw4w9WgXcQ', respond(401))).rejects.toThrow(/Public or Unlisted.*Allow embedding/)
  })

  it('explains missing videos', async () => {
    await expect(fetchVideoInfo('dQw4w9WgXcQ', respond(404))).rejects.toThrow(/no video at this link/)
  })

  it('explains network failures', async () => {
    const f = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(fetchVideoInfo('dQw4w9WgXcQ', f)).rejects.toThrow(OEmbedError)
    await expect(fetchVideoInfo('dQw4w9WgXcQ', f)).rejects.toThrow(/Could not reach YouTube/)
  })
})
