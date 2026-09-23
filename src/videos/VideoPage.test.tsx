import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { deleteVideo, getVideo, updateVideo } from '../data/videos'
import { loadGames, possessionCounts } from '../data/games'
import { WriteQueue, type QueueEntry, type QueueRow } from '../data/queue'
import { PLAYER_STATE, type PlayerController, type YTPlayerLike } from '../player/controller'
import type { Game } from '../data/types'
import { VideoPage } from './VideoPage'
import { summary } from './testData'

vi.mock('../data/videos', () => ({
  getVideo: vi.fn<typeof import('../data/videos').getVideo>(),
  updateVideo: vi.fn<typeof import('../data/videos').updateVideo>(),
  deleteVideo: vi.fn<typeof import('../data/videos').deleteVideo>(),
}))

vi.mock('../data/games', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/games')>()
  return {
    ...actual,
    loadGames: vi.fn<typeof actual.loadGames>(),
    possessionCounts: vi.fn<typeof actual.possessionCounts>(),
  }
})

// A player that is ready at once and whose time the test sets.
const fake = { t: 0 }
vi.mock('../player/YouTubePlayer', () => ({
  YouTubePlayer: ({ controller }: { controller: PlayerController }) => {
    useEffect(() => {
      const player: YTPlayerLike = {
        getCurrentTime: () => fake.t,
        getDuration: () => 600,
        getPlayerState: () => PLAYER_STATE.PAUSED,
        playVideo: () => {},
        pauseVideo: () => {},
        seekTo: (s) => {
          fake.t = s
        },
        setPlaybackRate: () => {},
        getPlaybackRate: () => 1,
        getAvailablePlaybackRates: () => [0.25, 0.5, 0.75, 1, 1.5, 2],
      }
      controller.attach(player)
      return () => controller.detach()
    }, [controller])
    return <div>player</div>
  },
}))

const written: string[] = []
let queue: WriteQueue
vi.mock('../app/QueueProvider', () => ({ useQueue: () => queue }))

function makeQueue() {
  let saved: QueueEntry[] = []
  return new WriteQueue(
    {
      upsert: async (table, row: QueueRow) => void written.push(`upsert ${table} ${JSON.stringify(row)}`),
      delete: async (table, id) => void written.push(`delete ${table} ${id}`),
    },
    { load: () => saved, save: (e) => (saved = e) },
    { set: () => 0, clear: () => {} }, // flush manually
  )
}

function ListStub() {
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  return <p>List page {notice}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/videos/v1']}>
      <Routes>
        <Route index element={<ListStub />} />
        <Route path="videos/:id" element={<VideoPage userId="u1" />} />
        <Route path="videos/:id/games/:gameId" element={<p>Tagging stub</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const press = (key: string, extra: KeyboardEventInit = {}) => fireEvent.keyDown(document.body, { key, ...extra })

function game(start_s: number, end_s: number | null, extra: Partial<Game> = {}): Game {
  return {
    id: `g-${start_s}`,
    user_id: 'u1',
    video_id: 'v1',
    start_s,
    end_s,
    my_side: 'right',
    format: 'singles',
    opponent: null,
    my_score: null,
    opp_score: null,
    notes: null,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
    ...extra,
  }
}

beforeEach(() => {
  fake.t = 0
  written.length = 0
  queue = makeQueue()
  vi.mocked(getVideo).mockResolvedValue(summary())
  vi.mocked(loadGames).mockResolvedValue([])
  vi.mocked(possessionCounts).mockResolvedValue(new Map())
})

describe('VideoPage', () => {
  it('says when the video does not exist', async () => {
    vi.mocked(getVideo).mockResolvedValue(null)
    renderPage()
    expect(await screen.findByText('Video not found')).toBeInTheDocument()
  })

  it('edits details (VID-3)', async () => {
    const video = summary({ title: 'Practice' })
    vi.mocked(getVideo).mockResolvedValue(video)
    vi.mocked(updateVideo).mockImplementation(async (_id, patch) => ({ ...video, ...patch, updated_at: 'later' }))
    renderPage()
    const save = await screen.findByRole('button', { name: 'Save details' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Recorded on'), { target: { value: '2026-09-23' } })
    fireEvent.change(screen.getByLabelText('Frame rate'), { target: { value: '60' } })
    fireEvent.click(save)
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(updateVideo).toHaveBeenCalledWith('v1', { title: 'Practice', recorded_on: '2026-09-23', fps: 60, notes: null })
  })

  it('confirms video deletion with the counts, then returns to the list (VID-3)', async () => {
    vi.mocked(getVideo).mockResolvedValue(summary({ title: 'Tuesday', game_count: 2, possession_count: 30, confirmed_possession_count: 30 }))
    vi.mocked(deleteVideo).mockResolvedValue()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete video…' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('This also removes 2 games and 30 possessions.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete video…' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete video' }))
    expect(await screen.findByText('List page Deleted “Tuesday”.')).toBeInTheDocument()
  })
})

describe('games on the video screen (GAM-1..4)', () => {
  it('asks for the side before the first game, then B starts and E ends it', async () => {
    renderPage()
    await screen.findByText(/Which side of the frame is your goal on/)
    fake.t = 12
    press('b')
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent(/Choose which side/)

    fireEvent.click(screen.getByRole('button', { name: 'Right' }))
    press('b')
    expect(await screen.findByRole('heading', { name: 'Game 1' })).toBeInTheDocument()
    expect(screen.getByText('open')).toBeInTheDocument()
    expect(screen.getByLabelText('My goal')).toHaveValue('right')

    fake.t = 95.5
    press('E')
    expect(await screen.findByRole('button', { name: '1:35.5' })).toBeInTheDocument()
    await act(() => queue.flush())
    expect(written).toHaveLength(1) // create and close coalesced into one write
    expect(written[0]).toMatch(/"start_s":12,"end_s":95.5,"my_side":"right"/)
  })

  it('B closes the open game and starts the next with the same side (GAM-1, GAM-2)', async () => {
    vi.mocked(loadGames).mockResolvedValue([game(10, null, { my_side: 'right' })])
    renderPage()
    await screen.findByRole('heading', { name: 'Game 1' })
    fake.t = 300
    press('b')
    expect(await screen.findByRole('heading', { name: 'Game 2' })).toBeInTheDocument()
    expect(screen.getByText(/Ended Game 1 and started Game 2 at 5:00.0/)).toBeInTheDocument()
    const selects = screen.getAllByLabelText('My goal')
    expect(selects.map((s) => (s as HTMLSelectElement).value)).toEqual(['right', 'right'])
  })

  it('refuses overlapping games and explains why (GAM-4)', async () => {
    vi.mocked(loadGames).mockResolvedValue([game(10, 100)])
    renderPage()
    await screen.findByRole('heading', { name: 'Game 1' })
    fake.t = 50
    press('b')
    expect(await screen.findByText(/inside Game 1 \(0:10.0–1:40.0\)/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Game 2' })).not.toBeInTheDocument()
  })

  it('edits game fields inline and queues the write (GAM-2)', async () => {
    vi.mocked(loadGames).mockResolvedValue([game(10, 100)])
    renderPage()
    fireEvent.change(await screen.findByLabelText('Opponent'), { target: { value: 'Tomáš' } })
    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'doubles' } })
    fireEvent.change(screen.getByLabelText('My score'), { target: { value: '5' } })
    expect(queue.getStatus().pending).toBe(1)
    await act(() => queue.flush())
    expect(written[0]).toMatch(/"format":"doubles","opponent":"Tomáš","my_score":5/)
  })

  it('clicking a game start seeks there (GAM-3), and Tag opens its tagging screen', async () => {
    vi.mocked(loadGames).mockResolvedValue([game(42, 100)])
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '0:42.0' }))
    expect(fake.t).toBe(42)
    fireEvent.click(screen.getByRole('link', { name: 'Tag →' }))
    expect(await screen.findByText('Tagging stub')).toBeInTheDocument()
  })

  it('deletes a game after confirming with its possession count', async () => {
    vi.mocked(loadGames).mockResolvedValue([game(10, 100)])
    vi.mocked(possessionCounts).mockResolvedValue(new Map([['g-10', 7]]))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete…' }))
    const dialog = screen.getByRole('alertdialog')
    expect(await within(dialog).findByText(/also deletes its 7 possessions/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete game' }))
    expect(screen.queryByRole('heading', { name: 'Game 1' })).not.toBeInTheDocument()
    await act(() => queue.flush())
    expect(written).toEqual(['delete games g-10'])
  })

  it('ignores shortcuts while typing in a field (TAG-1)', async () => {
    vi.mocked(loadGames).mockResolvedValue([game(10, null)])
    renderPage()
    const notes = await screen.findByLabelText('Notes', { selector: 'input' })
    fake.t = 50
    fireEvent.keyDown(notes, { key: 'e' })
    expect(screen.getByText('open')).toBeInTheDocument()
  })
})
