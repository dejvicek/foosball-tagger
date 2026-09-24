import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { getVideo } from '../data/videos'
import { loadGames } from '../data/games'
import { loadPossessions } from '../data/possessions'
import { WriteQueue, type QueueEntry, type QueueRow } from '../data/queue'
import type { Game, Possession } from '../data/types'
import { PLAYER_STATE, type PlayerController, type YTPlayerLike } from '../player/controller'
import { summary } from '../videos/testData'
import { emptyDraft } from './draft'
import { fromDraft } from './possessions'
import { TaggingPage } from './TaggingPage'

vi.mock('../data/videos', () => ({ getVideo: vi.fn<typeof import('../data/videos').getVideo>() }))
vi.mock('../data/games', () => ({ loadGames: vi.fn<typeof import('../data/games').loadGames>() }))
vi.mock('../data/possessions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/possessions')>()
  return { ...actual, loadPossessions: vi.fn<typeof actual.loadPossessions>() }
})

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
        getAvailablePlaybackRates: () => [1],
      }
      controller.attach(player)
      return () => controller.detach()
    }, [controller])
    return <div>player</div>
  },
}))

let queue: WriteQueue
let server: Map<string, QueueRow>
vi.mock('../app/QueueProvider', () => ({ useQueue: () => queue }))

function makeQueue() {
  let saved: QueueEntry[] = []
  return new WriteQueue(
    {
      upsert: async (_t, row) => void server.set(row.id, row),
      delete: async (_t, id) => void server.delete(id),
    },
    { load: () => saved, save: (e) => (saved = e) },
    { set: () => 0, clear: () => {} },
  )
}

const game: Game = {
  id: 'g1',
  user_id: 'u1',
  video_id: 'v1',
  start_s: 60,
  end_s: 300,
  my_side: 'left',
  format: 'singles',
  opponent: 'Olaf',
  my_score: null,
  opp_score: null,
  notes: null,
  created_at: '2026-09-24T00:00:00Z',
  updated_at: '2026-09-24T00:00:00Z',
}

function possession(start_s: number, shot_s: number, extra: Partial<Possession> = {}): Possession {
  return { ...fromDraft({ ...emptyDraft(), start_s, shot_s }, { id: `p-${start_s}`, userId: 'u1', gameId: 'g1', now: '2026-09-24T00:00:00Z' }), ...extra }
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/videos/v1/games/g1']}>
      <Routes>
        <Route path="videos/:id/games/:gameId" element={<TaggingPage userId="u1" />} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: /Game 1/ })
  // The time display reads the player every frame; once it shows the game start,
  // the opening seek has settled and the fake player's time is used as is.
  await waitFor(() => expect(screen.getByLabelText('Current time')).toHaveTextContent('1:00.0'))
}

const press = (key: string) => fireEvent.keyDown(document.body, { key })
const at = (t: number) => {
  fake.t = t
}
const saved = () => [...server.values()] as unknown as Possession[]
const flush = () => act(() => queue.flush())

beforeEach(() => {
  localStorage.clear()
  fake.t = 0
  server = new Map()
  queue = makeQueue()
  vi.mocked(getVideo).mockResolvedValue(summary({ duration_s: 600 }))
  vi.mocked(loadGames).mockResolvedValue([game])
  vi.mocked(loadPossessions).mockResolvedValue([])
})

describe('tagging screen keyboard (TAG-1..5, PRD §8)', () => {
  it('opens at the game start (GAM-3)', async () => {
    await renderPage()
    expect(fake.t).toBe(60)
  })

  it('S, tag keys, F, Enter saves a possession and resets Setup to Middle', async () => {
    await renderPage()
    at(70)
    press('s')
    expect(screen.getByText(/Possession running/)).toBeInTheDocument()
    press('z')
    press('2')
    press('w')
    at(74.2)
    press('f')
    expect(screen.getByText(/Still blank: hole, result, execution/)).toBeInTheDocument()
    press('a')
    press('g')
    press('j')
    expect(screen.getByText(/All tagged/)).toBeInTheDocument()
    press('Enter')
    await flush()
    expect(saved()).toEqual([
      expect.objectContaining({
        start_s: 70,
        shot_s: 74.2,
        setup: 'Pull side',
        shot_type: 'Pull',
        direction: 'Push',
        hole: 'Pull-side lane',
        result: 'Goal',
        execution: 'Proper',
        source: 'manual',
        review_status: 'confirmed',
      }),
    ])
    expect(screen.getByRole('button', { name: /^Middle\s*X$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('table')).toHaveTextContent('4.2 s')
  })

  it('S after F saves and starts the next; N saves a No shot at once', async () => {
    await renderPage()
    at(70)
    press('s')
    at(75)
    press('f')
    at(80)
    press('s')
    at(90)
    press('n')
    await flush()
    const rows = saved().sort((a, b) => (a.start_s ?? 0) - (b.start_s ?? 0))
    expect(rows.map((p) => [p.start_s, p.shot_s, p.shot_type])).toEqual([
      [70, 75, null],
      [80, 90, 'No shot'],
    ])
  })

  it('Esc clears the draft; Enter on an empty draft explains', async () => {
    await renderPage()
    at(70)
    press('s')
    press('Escape')
    expect(screen.getByText('Press S when the ball is set.')).toBeInTheDocument()
    press('Enter')
    expect(screen.getByText(/Nothing to save yet/)).toBeInTheDocument()
  })

  it('U deletes the last possession saved on this page', async () => {
    await renderPage()
    at(70)
    press('s')
    at(72)
    press('n')
    at(80)
    press('s')
    at(82)
    press('n')
    await flush()
    expect(saved()).toHaveLength(2)
    press('u')
    await flush()
    expect(saved().map((p) => p.start_s)).toEqual([70])
    press('u')
    press('u')
    expect(screen.getByText(/Nothing to undo/)).toBeInTheDocument()
  })

  it('refuses F before S and times outside the game (TAG-4, TAG-5)', async () => {
    await renderPage()
    at(100)
    press('s')
    at(90)
    press('f')
    expect(screen.getByText(/can’t be before the start/)).toBeInTheDocument()
    at(301)
    press('f')
    expect(screen.getByText(/outside Game 1 \(1:00.0–5:00.0\)/)).toBeInTheDocument()
  })

  it('ignores tag keys while a log field has focus', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75)])
    await renderPage()
    const select = screen.getByLabelText('Result for possession 1')
    fireEvent.keyDown(select, { key: 's' })
    expect(screen.getByText('Press S when the ball is set.')).toBeInTheDocument()
  })

  it('keeps an unsaved draft across a reload', async () => {
    const first = render(
      <MemoryRouter initialEntries={['/videos/v1/games/g1']}>
        <Routes>
          <Route path="videos/:id/games/:gameId" element={<TaggingPage userId="u1" />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: /Game 1/ })
    await waitFor(() => expect(screen.getByLabelText('Current time')).toHaveTextContent('1:00.0'))
    at(70)
    press('s')
    press('c')
    first.unmount()
    at(60)
    await renderPage()
    expect(screen.getByText(/Possession running/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Push side\s*C$/ })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('possession log (TAG-7)', () => {
  it('edits a field inline; No shot clears the shot fields', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75, { result: 'Goal', hole: 'Middle lane' })])
    await renderPage()
    fireEvent.change(screen.getByLabelText('Shot type for possession 1'), { target: { value: 'No shot' } })
    await flush()
    expect(saved()[0]).toMatchObject({ shot_type: 'No shot', result: null, hole: null })
    expect(screen.getByLabelText('Result for possession 1')).toBeDisabled()
  })

  it('clicking the start time seeks one second before it', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75)])
    await renderPage()
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: '1:10.0' }))
    expect(fake.t).toBe(69)
  })

  it('deletes a row after one confirmation', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75)])
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Delete possession 1' }))
    expect(screen.getByRole('table')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm: delete possession 1' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows Confirm and Reject for unreviewed candidates', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75, { source: 'auto', review_status: 'unreviewed', confidence: 0.8 })])
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await flush()
    expect(saved()[0]).toMatchObject({ review_status: 'confirmed' })
  })
})

describe('timeline (TAG-6)', () => {
  it('draws one segment per possession, with its tags on hover, and jumps before it on click', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75, { result: 'Goal' }), possession(100, 104, { shot_type: 'No shot' })])
    await renderPage()
    const seg = screen.getByRole('button', { name: /^#1 Middle · Goal\. Goal\./ })
    expect(seg).toHaveClass('goal')
    expect(screen.getByRole('button', { name: /^#2 Middle · No shot\./ })).toHaveClass('noshot')
    fireEvent.click(seg)
    expect(fake.t).toBe(69)
  })
})
