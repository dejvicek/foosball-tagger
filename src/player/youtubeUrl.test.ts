import { parseYouTubeUrl } from './youtubeUrl'

const ID = 'dQw4w9WgXcQ'

describe('parseYouTubeUrl', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?v=${ID}&t=42s`,
    `https://www.youtube.com/watch?feature=share&v=${ID}&list=PL123`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}#t=1m`,
    `http://www.youtube.com/watch?v=${ID}`,
    `www.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?t=90&si=abc`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube.com/live/${ID}?si=xyz&t=3600`,
    `https://youtube.com/shorts/${ID}?feature=share`,
    `https://www.youtube.com/embed/${ID}?start=10`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `  https://youtu.be/${ID}  `,
  ])('accepts %s', (url) => {
    expect(parseYouTubeUrl(url)).toEqual({ ok: true, youtubeId: ID })
  })

  it.each([
    ['', /Paste a YouTube link/],
    [ID, /not a YouTube video link/],
    ['https://vimeo.com/123456', /not a YouTube video link/],
    [`https://evil.example/watch?v=${ID}`, /not a YouTube video link/],
    [`https://youtube.com.evil.example/watch?v=${ID}`, /not a YouTube video link/],
    ['https://www.youtube.com/@somechannel', /single video/],
    ['https://www.youtube.com/playlist?list=PL123', /single video/],
    ['https://www.youtube.com/watch', /single video/],
    ['https://youtu.be/dQw4w9', /incomplete/],
    ['ftp://youtube.com/watch?v=dQw4w9WgXcQ', /not a YouTube video link/],
  ])('rejects %j', (url, message) => {
    expect(parseYouTubeUrl(url)).toEqual({ ok: false, message: expect.stringMatching(message) })
  })
})
