import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { addVideo, listVideos, sortNewestFirst } from '../data/videos'
import { VideosPage } from './VideosPage'
import { summary } from './testData'

vi.mock('../data/videos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/videos')>()
  return {
    sortNewestFirst: actual.sortNewestFirst,
    listVideos: vi.fn<typeof actual.listVideos>(),
    addVideo: vi.fn<typeof actual.addVideo>(),
  }
})

function VideoStub() {
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  return <p>Video page {location.pathname} {notice}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route index element={<VideosPage />} />
        <Route path="videos/:id" element={<VideoStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

function submit(url: string) {
  fireEvent.change(screen.getByLabelText('YouTube link'), { target: { value: url } })
  fireEvent.click(screen.getByRole('button', { name: 'Add video' }))
}

beforeEach(() => {
  vi.mocked(listVideos).mockResolvedValue([])
})

describe('VideosPage list (VID-2)', () => {
  it('lists videos with date, counts and a running job', async () => {
    vi.mocked(listVideos).mockResolvedValue([
      summary({ title: 'Tuesday', recorded_on: '2026-09-22', game_count: 3, confirmed_possession_count: 41, job_running: true }),
    ])
    renderPage()
    const link = await screen.findByRole('link', { name: 'Tuesday' })
    const row = link.closest('tr')
    expect(row).toHaveTextContent('3')
    expect(row).toHaveTextContent('41')
    expect(row).toHaveTextContent('Running')
  })

  it('explains the empty list', async () => {
    renderPage()
    expect(await screen.findByText(/No videos yet/)).toBeInTheDocument()
  })

  it('shows a load error and retries', async () => {
    vi.mocked(listVideos).mockRejectedValueOnce(new Error('Could not load your videos: offline'))
    renderPage()
    expect(await screen.findByText(/Could not load your videos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/No videos yet/)).toBeInTheDocument()
    expect(listVideos).toHaveBeenCalledTimes(2)
  })
})

describe('adding a video (VID-1)', () => {
  it('states the embedding requirement', async () => {
    renderPage()
    expect(screen.getByText(/Public or Unlisted and allow embedding/)).toBeInTheDocument()
    await screen.findByText(/No videos yet/)
  })

  it('rejects a non-YouTube link without calling the server', async () => {
    renderPage()
    submit('https://vimeo.com/1234')
    expect(await screen.findByRole('alert')).toHaveTextContent(/not a YouTube video link/)
    expect(addVideo).not.toHaveBeenCalled()
  })

  it('adds the video and opens it', async () => {
    vi.mocked(addVideo).mockResolvedValue({ video: summary({ id: 'new-id' }), existed: false })
    renderPage()
    submit('https://youtu.be/dQw4w9WgXcQ?t=30')
    expect(await screen.findByText(/Video page \/videos\/new-id/)).toBeInTheDocument()
    expect(addVideo).toHaveBeenCalledWith('dQw4w9WgXcQ')
  })

  it('opens an existing video instead of failing', async () => {
    vi.mocked(addVideo).mockResolvedValue({ video: summary({ id: 'old-id' }), existed: true })
    renderPage()
    submit('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(await screen.findByText(/\/videos\/old-id.*already in your list/)).toBeInTheDocument()
  })

  it('shows why YouTube refused the video', async () => {
    vi.mocked(addVideo).mockRejectedValue(new Error('YouTube does not allow this video to be embedded'))
    renderPage()
    submit('https://youtu.be/dQw4w9WgXcQ')
    expect(await screen.findByRole('alert')).toHaveTextContent('does not allow this video to be embedded')
    expect(screen.getByRole('button', { name: 'Add video' })).toBeEnabled()
  })
})

describe('sortNewestFirst', () => {
  it('orders by recorded date, falling back to the date added', () => {
    const sorted = sortNewestFirst([
      summary({ id: 'old', recorded_on: '2026-01-01' }),
      summary({ id: 'undated', recorded_on: null, created_at: '2026-06-01T00:00:00Z' }),
      summary({ id: 'new', recorded_on: '2026-09-01' }),
    ])
    expect(sorted.map((v) => v.id)).toEqual(['new', 'undated', 'old'])
  })
})
