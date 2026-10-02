import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { getVideo } from '../data/videos'
import { loadGames } from '../data/games'
import { loadMatches } from '../data/matches'
import { loadPossessions } from '../data/possessions'
import { WriteQueue, type QueueEntry, type QueueRow } from '../data/queue'
import type { Game, Match, Possession } from '../data/types'
import { PLAYER_STATE, type PlayerController, type YTPlayerLike } from '../player/controller'
import { summary } from '../videos/testData'
import { emptyDraft } from './draft'
import { fromDraft } from './possessions'
import { TaggingPage } from './TaggingPage'

vi.mock('../data/videos', () => ({ getVideo: vi.fn<typeof import('../data/videos').getVideo>() }))
vi.mock('../data/games', () => ({ loadGames: vi.fn<typeof import('../data/games').loadGames>() }))
vi.mock('../data/matches', () => ({ loadMatches: vi.fn<typeof import('../data/matches').loadMatches>() }))
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

const match: Match = {
  id: 'm1',
  user_id: 'u1',
  video_id: 'v1',
  best_of: null,
  format: 'singles',
  teammate: null,
  opponent: 'Olaf',
  opponent2: null,
  notes: null,
  created_at: '2026-09-24T00:00:00Z',
  updated_at: '2026-09-24T00:00:00Z',
}

const game: Game = {
  id: 'g1',
  user_id: 'u1',
  video_id: 'v1',
  match_id: 'm1',
  start_s: 60,
  end_s: 300,
  my_side: 'left',
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
  vi.mocked(loadMatches).mockResolvedValue([match])
  vi.mocked(loadPossessions).mockResolvedValue([])
})

describe('tagging screen keyboard (TAG-1..5, PRD §8)', () => {
  it('opens at the game start (GAM-3)', async () => {
    await renderPage()
    expect(fake.t).toBe(60)
  })

  it('S, tag keys, F, Enter saves a possession and resets Setup to Middle (ADR-0026)', async () => {
    await renderPage()
    at(70)
    press('r')
    expect(screen.getByText(/Possession running/)).toBeInTheDocument()
    press('a')
    press('w')
    at(74.2)
    press('f')
    expect(screen.getByText(/Still blank: hole, execution, result/)).toBeInTheDocument()
    press('2')
    expect(screen.getByTitle(/Worked out from setup and hole/)).toHaveTextContent('Movement Straight') // pull side → pull short
    press('c')
    press('g')
    press('z')
    expect(screen.getByText(/All tagged/)).toBeInTheDocument()
    press('Enter')
    await flush()
    expect(saved()).toEqual([
      expect.objectContaining({
        start_s: 70,
        shot_s: 74.2,
        setup: 'Pull side',
        shot_type: 'Pull',
        hole: 'Pull short',
        shot_direction: 'Z',
        result: 'Goal',
        execution: 'Proper',
        source: 'manual',
        review_status: 'confirmed',
      }),
    ])
    expect(screen.getByRole('button', { name: /^Middle\s*S$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('table', { name: 'Possessions' })).toHaveTextContent('4.2 s')
  })

  it('S after F saves and starts the next; N saves a No shot at once', async () => {
    await renderPage()
    at(70)
    press('r')
    at(75)
    press('f')
    press('3')
    press('z')
    press('g')
    at(80)
    press('r')
    at(90)
    press('v')
    await flush()
    const rows = saved().sort((a, b) => (a.start_s ?? 0) - (b.start_s ?? 0))
    expect(rows.map((p) => [p.start_s, p.shot_s, p.shot_type])).toEqual([
      [70, 75, 'Pin'],
      [80, 90, 'No shot'],
    ])
  })

  it('Save stays disabled until every field is tagged (ADR-0037)', async () => {
    await renderPage()
    const save = () => screen.getByRole('button', { name: /^Save\s*Enter$/ })
    expect(save()).toBeDisabled()
    at(70)
    press('r')
    at(72)
    press('f')
    press('3')
    press('z')
    expect(save()).toBeDisabled()
    press('Enter')
    expect(screen.getByText('Can’t save yet. Still blank: result.')).toBeInTheDocument()
    press('g')
    expect(save()).toBeEnabled()
  })

  it('Backspace or Esc clears the draft; Enter on an empty draft explains', async () => {
    await renderPage()
    at(70)
    press('r')
    press('Backspace')
    expect(screen.getByText('Press R when the ball is set.')).toBeInTheDocument()
    press('r')
    press('Escape')
    expect(screen.getByText('Press R when the ball is set.')).toBeInTheDocument()
    press('Enter')
    expect(screen.getByText(/Nothing to save yet/)).toBeInTheDocument()
  })

  it('⌘Z and Ctrl+Z do not delete anything (ADR-0034)', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([])
    await renderPage()
    at(70)
    press('r')
    at(72)
    press('v')
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true })
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    await flush()
    expect(saved()).toHaveLength(1)
  })

  it('J / L / K drive the player from the right hand', async () => {
    await renderPage()
    at(100)
    press('l')
    expect(fake.t).toBe(101)
    fireEvent.keyDown(document.body, { key: 'J', shiftKey: true })
    expect(fake.t).toBe(96)
  })

  it('refuses F before S and times outside the game (TAG-4, TAG-5)', async () => {
    await renderPage()
    at(100)
    press('r')
    at(90)
    press('f')
    expect(screen.getByText(/can’t be before the start/)).toBeInTheDocument()
    at(301)
    press('f')
    expect(screen.getByText(/outside Match 1 · Game 1 \(1:00.0–5:00.0\)/)).toBeInTheDocument()
  })

  it('ignores tag keys while a field has focus', async () => {
    const input = document.createElement('input')
    document.body.append(input)
    await renderPage()
    fireEvent.keyDown(input, { key: 'r' })
    expect(screen.getByText('Press R when the ball is set.')).toBeInTheDocument()
    input.remove()
  })

  it('reverses the hole and setup keys and buttons when I stand on the right (ADR-0031, ADR-0035)', async () => {
    vi.mocked(loadGames).mockResolvedValue([{ ...game, my_side: 'right' }])
    await renderPage()
    at(70)
    press('r')
    press('1')
    expect(screen.getByRole('button', { name: /^Push long\s*1$/i })).toHaveAttribute('aria-pressed', 'true')
    const holes = within(screen.getByRole('group', { name: 'Hole' })).getAllByRole('button')
    expect(holes.map((b) => b.title)).toEqual(['Push long', 'Push short', 'Middle', 'Pull short', 'Pull long'])
    press('a')
    expect(screen.getByRole('button', { name: /^Push side\s*A$/i })).toHaveAttribute('aria-pressed', 'true')
    const setups = within(screen.getByRole('group', { name: 'Setup' })).getAllByRole('button')
    expect(setups.map((b) => b.title)).toEqual(['Push side', 'Middle', 'Pull side'])
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
    press('r')
    press('d')
    first.unmount()
    at(60)
    await renderPage()
    expect(screen.getByText(/Possession running/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Push side\s*D$/i })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('possession log (TAG-7, ADR-0030)', () => {
  const log = () => screen.getByRole('table', { name: 'Possessions' })

  it('is read-only: no fields to edit in the table', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75, { result: 'Goal', hole: 'Middle' })])
    await renderPage()
    expect(within(log()).queryAllByRole('combobox')).toEqual([])
    expect(log()).toHaveTextContent('Goal')
  })

  it('clicking a row opens it in the panel and seeks one second before it; Enter saves the changes', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75, { result: 'Goal', hole: 'Middle', execution: 'Proper' })])
    await renderPage()
    fireEvent.click(within(log()).getByText('Goal'))
    expect(fake.t).toBe(69)
    expect(screen.getByText('Editing possession 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Goal\s*G$/i })).toHaveAttribute('aria-pressed', 'true')
    press('b')
    press('c')
    at(76)
    press('f')
    press('Enter')
    await flush()
    expect(saved()[0]).toMatchObject({ start_s: 70, shot_s: 76, result: 'No goal', shot_direction: 'Z', hole: 'Middle' })
    expect(screen.queryByText('Editing possession 1')).not.toBeInTheDocument()
    expect(screen.getByText(/Saved the changes to possession 1/)).toBeInTheDocument()
  })

  it('Esc cancels the edit and the new-possession draft comes back', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75, { result: 'Goal' })])
    await renderPage()
    at(100)
    press('r')
    fireEvent.click(within(log()).getByText('Goal'))
    press('b')
    press('Escape')
    await flush()
    expect(saved()).toEqual([])
    expect(screen.getByText(/Possession running/)).toBeInTheDocument()
  })

  it('No shot in edit mode clears the shot fields and keeps the times', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75, { result: 'Goal', hole: 'Middle' })])
    await renderPage()
    fireEvent.click(within(log()).getByRole('button', { name: '1:15.0' }))
    expect(fake.t).toBe(75)
    press('v')
    press('Enter')
    await flush()
    expect(saved()[0]).toMatchObject({ start_s: 70, shot_s: 75, setup: null, shot_type: 'No shot', result: null, hole: null, shot_direction: null, execution: null })
  })

  it('No shot in edit mode disables every tag button; F brings back the defaults (ADR-0037)', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75, { result: 'Goal', hole: 'Middle', execution: 'Proper' })])
    await renderPage()
    fireEvent.click(within(log()).getByText('Goal'))
    press('v')
    const panel = screen.getByRole('complementary', { name: 'Edit possession 1' })
    const tags = within(panel).getAllByRole('button', { pressed: false }).concat(within(panel).queryAllByRole('button', { pressed: true }))
    expect(tags.length).toBeGreaterThan(0)
    for (const b of tags) expect(b).toBeDisabled()
    for (const name of [/^Start/, /^Shot\s/, /^No shot/]) expect(within(panel).getByRole('button', { name })).toBeEnabled()
    expect(within(panel).getByRole('button', { name: /^Save changes/ })).toBeEnabled()
    at(76)
    press('f')
    expect(screen.getByRole('button', { name: /^Pin\s*Q$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Middle\s*S$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Goal\s*G$/i })).toHaveAttribute('aria-pressed', 'false')
    expect(within(panel).getByRole('button', { name: /^Save changes/ })).toBeDisabled()
  })

  it('deletes a row after one confirmation', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75)])
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Delete possession 1' }))
    expect(screen.getByRole('table', { name: 'Possessions' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm: delete possession 1' }))
    expect(screen.queryByRole('table', { name: 'Possessions' })).not.toBeInTheDocument()
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
  it('draws one segment per possession, with its tags on hover; a click opens it for editing from 1 s before it', async () => {
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75, { result: 'Goal' }), possession(100, 104, { shot_type: 'No shot', shot_direction: null })])
    await renderPage()
    const seg = screen.getByRole('button', { name: /^#1 Middle · Pin · Straight · Goal\. Goal, execution not tagged\./ })
    expect(seg).toHaveClass('goal', 'blank')
    expect(screen.getByRole('button', { name: /^#2 Middle · No shot\. No shot\./ })).toHaveClass('noshot')
    fireEvent.click(seg)
    expect(fake.t).toBe(69)
    expect(screen.getByText('Editing possession 1')).toBeInTheDocument()
    expect(seg).toHaveAttribute('aria-pressed', 'true')
    expect(seg).toHaveClass('current') // white ring, like the running possession (ADR-0039)
  })

  it('lists No result, Not tagged and Unreviewed candidate in the legend only when such a segment is drawn (ADR-0038)', async () => {
    const legend = () => document.querySelector('.legend') as HTMLElement
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75, { result: 'Goal', execution: 'Proper' })])
    await renderPage()
    expect(legend()).toHaveTextContent('Goal')
    expect(legend()).toHaveTextContent('Current possession')
    for (const t of ['No result', 'Not tagged', 'Unreviewed candidate']) expect(legend()).not.toHaveTextContent(t)
    cleanup()
    vi.mocked(loadPossessions).mockResolvedValue([possession(70, 75, { review_status: 'unreviewed' })])
    await renderPage()
    for (const t of ['No result', 'Not tagged', 'Unreviewed candidate']) expect(legend()).toHaveTextContent(t)
  })
})
